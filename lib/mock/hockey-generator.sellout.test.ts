import { describe, expect, it, beforeAll } from "vitest";
import { generateMockData } from "@/lib/mock/hockey-generator";
import {
  getSectorCapacitiesForMatch,
  splitSectorCapacity,
} from "@/lib/arena-sector-inventory";
import { ALL_SECTORS, allowedPriceZonesForSector } from "@/lib/ticket-filter-options";
import {
  buildZoneSectorTree,
} from "@/lib/tickets-zone-sector-analytics";
import { isSoldOutOccupancyMatch, getMatchParkingCapacity, getMatchPlanRevenue, getMatchPlanTickets, HIGH_REVENUE_PLAN_THRESHOLD, MAX_MID_REVENUE_OCCUPANCY, MAX_REGULAR_TICKET_PLAN_FULFILLMENT, MAX_TICKET_PLAN_FULFILLMENT, MID_REVENUE_PLAN_MIN, MIN_HIGH_REVENUE_OCCUPANCY, MIN_OVER_PLAN_OCCUPANCY, MIN_SOLD_OUT_TICKET_PLAN_FULFILLMENT, OVER_PLAN_REVENUE_THRESHOLD, occupancyMassCapacity, PARKING_CAPACITY_SECONDARY, SECONDARY_ARENA_CAPACITY } from "@/lib/ticket-plan";
import { getTicketIssuedQuantity } from "@/lib/ticket-sales-metrics";
import { formatPercent } from "@/lib/format";
import type { Match, PriceZone, Sector, Transaction } from "@/types/dashboard";

function arenaIssuedForMatch(match: Match, transactions: Transaction[]): number {
  let issued = 0;
  for (const tx of transactions) {
    if (tx.stream !== "tickets" || tx.ticketType !== "arena") continue;
    if (tx.matchId !== match.id) continue;
    issued += getTicketIssuedQuantity(tx);
  }
  return issued;
}

function occupancyIssuedForMatch(match: Match, transactions: Transaction[]): number {
  let issued = 0;
  for (const tx of transactions) {
    if (tx.stream !== "tickets") continue;
    if (tx.matchId !== match.id) continue;
    issued += getTicketIssuedQuantity(tx);
  }
  return issued;
}

function paidSoldByCombo(
  matchId: string,
  transactions: Transaction[],
): Map<string, number> {
  const sold = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.stream !== "tickets" || tx.ticketType !== "arena") continue;
    if (tx.matchId !== matchId || !tx.sector || !tx.priceZone) continue;
    if (!(tx.amount > 0)) continue;
    const key = `${tx.sector}|${tx.priceZone}`;
    sold.set(key, (sold.get(key) ?? 0) + tx.quantity);
  }
  return sold;
}

function issuedByCombo(
  matchId: string,
  transactions: Transaction[],
): Map<string, number> {
  const issued = new Map<string, number>();
  for (const tx of transactions) {
    if (tx.stream !== "tickets" || tx.ticketType !== "arena") continue;
    if (tx.matchId !== matchId || !tx.sector || !tx.priceZone) continue;
    const key = `${tx.sector}|${tx.priceZone}`;
    issued.set(key, (issued.get(key) ?? 0) + getTicketIssuedQuantity(tx));
  }
  return issued;
}

type ArenaComboStat = { paid: number; issued: number; revenue: number };

function comboStatsFromTransactions(
  matchId: string,
  transactions: Transaction[],
): Map<string, ArenaComboStat> {
  const stats = new Map<string, ArenaComboStat>();
  for (const tx of transactions) {
    if (tx.stream !== "tickets" || tx.ticketType !== "arena") continue;
    if (tx.matchId !== matchId || !tx.sector || !tx.priceZone) continue;
    const key = `${tx.sector}|${tx.priceZone}`;
    const row: ArenaComboStat = stats.get(key) ?? {
      paid: 0,
      issued: 0,
      revenue: 0,
    };
    if (tx.amount > 0) row.paid += tx.quantity;
    row.issued += getTicketIssuedQuantity(tx);
    row.revenue += tx.amount;
    stats.set(key, row);
  }
  return stats;
}

function inventoryCombos(match: Match): { sector: Sector; zone: PriceZone; mass: number }[] {
  const sectors = getSectorCapacitiesForMatch(match);
  if (!sectors) return [];
  const combos: { sector: Sector; zone: PriceZone; mass: number }[] = [];
  for (const sector of ALL_SECTORS) {
    const cap = sectors[sector] ?? 0;
    if (!(cap > 0)) continue;
    const split = splitSectorCapacity(sector, cap);
    for (const zone of allowedPriceZonesForSector(sector)) {
      const mass = split[zone] ?? 0;
      if (!(mass > 0)) continue;
      combos.push({ sector, zone, mass });
    }
  }
  return combos;
}

describe("hockey generator sold-out occupancy", () => {
  let matches: Match[];
  let transactions: Transaction[];
  let redemptionsByMatch: Map<string, number>;

  beforeAll(() => {
    const data = generateMockData();
    matches = data.matches;
    transactions = data.transactions;
    redemptionsByMatch = new Map();
    for (const redemption of data.subscriptionRedemptions) {
      redemptionsByMatch.set(
        redemption.matchId,
        (redemptionsByMatch.get(redemption.matchId) ?? 0) + 1,
      );
    }
  });

  it("issues a full bowl for class_1 and playoff, not for lower regular classes", () => {
    const soldOut = matches.filter((match) => isSoldOutOccupancyMatch(match));
    const partial = matches.filter(
      (match) =>
        match.eventCompleted &&
        (match.matchClass === "class_2" || match.matchClass === "class_3"),
    );
    expect(soldOut.length).toBeGreaterThan(0);
    expect(partial.length).toBeGreaterThan(0);

    for (const match of soldOut) {
      expect(arenaIssuedForMatch(match, transactions)).toBe(match.capacity);
    }

    const vhl = matches.filter((match) => match.league === "VHL");
    expect(vhl.length).toBeGreaterThan(0);
    for (const match of vhl) {
      expect(match.arena).toBe("secondary");
      expect(match.capacity).toBe(SECONDARY_ARENA_CAPACITY);
      expect(getMatchParkingCapacity(match)).toBe(PARKING_CAPACITY_SECONDARY);
      expect(occupancyMassCapacity(match.capacity)).toBe(4800);
    }

    const underCapacity = partial.filter(
      (match) => arenaIssuedForMatch(match, transactions) < match.capacity,
    );
    expect(underCapacity.length).toBeGreaterThan(0);
  });

  it("sells paid tickets in every inventory sector and allowed zone without exceeding 100%", () => {
    const withArenaSales = matches.filter((match) =>
      transactions.some(
        (tx) =>
          tx.stream === "tickets" &&
          tx.ticketType === "arena" &&
          tx.matchId === match.id &&
          tx.amount > 0,
      ),
    );
    expect(withArenaSales.length).toBeGreaterThan(0);

    for (const match of withArenaSales) {
      const combos = inventoryCombos(match);
      expect(combos.length).toBeGreaterThan(0);
      const paid = paidSoldByCombo(match.id, transactions);
      const issued = issuedByCombo(match.id, transactions);
      const seenSectors = new Set<Sector>();

      for (const combo of combos) {
        const key = `${combo.sector}|${combo.zone}`;
        expect(paid.get(key) ?? 0, `${match.id} ${key} paid`).toBeGreaterThan(0);
        expect(issued.get(key) ?? 0).toBeLessThanOrEqual(combo.mass);
        seenSectors.add(combo.sector);
      }

      for (const sector of ALL_SECTORS) {
        const cap = getSectorCapacitiesForMatch(match)?.[sector] ?? 0;
        if (!(cap > 0)) continue;
        expect(seenSectors.has(sector)).toBe(true);
      }

      expect(arenaIssuedForMatch(match, transactions)).toBeLessThanOrEqual(
        match.capacity,
      );
    }
  });

  it("keeps ArenaComboStat rows with paid, issued, and revenue; free tickets do not add revenue", () => {
    let comboRows = 0;
    let freeIssued = 0;

    for (const match of matches) {
      const stats = comboStatsFromTransactions(match.id, transactions);
      for (const row of stats.values()) {
        comboRows += 1;
        expect(Object.keys(row).sort()).toEqual(["issued", "paid", "revenue"]);
        expect(row.paid).toEqual(expect.any(Number));
        expect(row.issued).toEqual(expect.any(Number));
        expect(row.revenue).toEqual(expect.any(Number));
        expect(row.issued).toBeGreaterThanOrEqual(row.paid);
        expect(row.revenue).toBeGreaterThanOrEqual(0);
      }
    }
    expect(comboRows).toBeGreaterThan(0);

    const freeArenaTickets = transactions.filter(
      (tx) =>
        tx.stream === "tickets" &&
        tx.ticketType === "arena" &&
        ((tx.freeQuantity ?? 0) > 0 || tx.description === "Бесплатный билет"),
    );
    expect(freeArenaTickets.length).toBeGreaterThan(0);
    for (const tx of freeArenaTickets) {
      expect(tx.amount).toBe(0);
      freeIssued += getTicketIssuedQuantity(tx);
    }
    expect(freeIssued).toBeGreaterThan(0);
  });

  it("sells paid parking tickets for every match that has arena ticket sales", () => {
    const withArenaSales = matches.filter((match) =>
      transactions.some(
        (tx) =>
          tx.stream === "tickets" &&
          tx.ticketType === "arena" &&
          tx.matchId === match.id &&
          tx.amount > 0,
      ),
    );
    expect(withArenaSales.length).toBeGreaterThan(0);

    for (const match of withArenaSales) {
      const parking = transactions.filter(
        (tx) =>
          tx.stream === "tickets" &&
          tx.ticketType === "parking" &&
          tx.matchId === match.id &&
          tx.amount > 0 &&
          tx.quantity > 0,
      );
      expect(parking.length, `${match.id} parking txs`).toBeGreaterThan(0);
      const paidQty = parking.reduce((sum, tx) => sum + tx.quantity, 0);
      expect(paidQty, `${match.id} parking qty`).toBeGreaterThan(0);
      for (const tx of parking) {
        expect(tx.priceZone, `${tx.id} parking zone`).toBeUndefined();
        expect(tx.sector, `${tx.id} parking sector`).toBeUndefined();
      }
      expect(paidQty).toBeLessThanOrEqual(getMatchParkingCapacity(match));
    }
  });

  it("applies a non-zero loyalty discount on KHL ticket sales", () => {
    const khlMatchIds = new Set(
      matches
        .filter((match) => match.league === "KHL" && match.season === "2025/26")
        .map((match) => match.id),
    );
    const khlTickets = transactions.filter(
      (tx) =>
        tx.stream === "tickets" &&
        tx.matchId != null &&
        khlMatchIds.has(tx.matchId) &&
        tx.amount > 0,
    );
    const loyalty = khlTickets.reduce(
      (sum, tx) => sum + (tx.loyaltyDiscount ?? 0),
      0,
    );
    const revenue = khlTickets.reduce((sum, tx) => sum + tx.amount, 0);
    const pct = revenue + loyalty > 0 ? (loyalty / (revenue + loyalty)) * 100 : 0;

    expect(khlTickets.length).toBeGreaterThan(0);
    expect(loyalty).toBeGreaterThan(0);
    expect(pct).toBeGreaterThan(1);
    expect(pct).toBeLessThan(6);
    expect(formatPercent(pct)).toBe(formatPercent(3.1));
  });

  it("keeps per-match ticket revenue and sold qty at most 105% of plan", () => {
    const epsilon = 1e-9;
    let withPlan = 0;
    for (const match of matches) {
      const planRevenue = getMatchPlanRevenue(match);
      const planTickets = getMatchPlanTickets(match);
      let revenue = 0;
      let tickets = 0;
      for (const tx of transactions) {
        if (tx.stream !== "tickets" || tx.matchId !== match.id) continue;
        revenue += tx.amount;
        tickets += tx.quantity;
      }
      if (planRevenue > 0 && revenue > 0) {
        withPlan += 1;
        expect(
          revenue / planRevenue,
          `${match.id} revenue fulfillment`,
        ).toBeLessThanOrEqual(MAX_TICKET_PLAN_FULFILLMENT + epsilon);
      }
      if (planTickets > 0 && tickets > 0) {
        expect(
          tickets / planTickets,
          `${match.id} ticket fulfillment`,
        ).toBeLessThanOrEqual(MAX_TICKET_PLAN_FULFILLMENT + epsilon);
      }
    }
    expect(withPlan).toBeGreaterThan(0);
  });

  it("keeps class_1 and playoff revenue/plan in [99%, 105%]", () => {
    const epsilon = 1e-9;
    let soldOut = 0;
    for (const match of matches) {
      if (!isSoldOutOccupancyMatch(match)) continue;
      const planRevenue = getMatchPlanRevenue(match);
      if (!(planRevenue > 0)) continue;
      let revenue = 0;
      for (const tx of transactions) {
        if (tx.stream !== "tickets" || tx.matchId !== match.id) continue;
        revenue += tx.amount;
      }
      if (!(revenue > 0)) continue;
      soldOut += 1;
      const ratio = revenue / planRevenue;
      expect(
        ratio,
        `${match.id} ${match.matchClass} revenue fulfillment`,
      ).toBeGreaterThanOrEqual(MIN_SOLD_OUT_TICKET_PLAN_FULFILLMENT - epsilon);
      expect(ratio).toBeLessThanOrEqual(MAX_TICKET_PLAN_FULFILLMENT + epsilon);
    }
    expect(soldOut).toBeGreaterThan(0);
  });

  it("keeps class_2 and class_3 revenue/plan at most 90%", () => {
    const epsilon = 1e-9;
    let regular = 0;
    for (const match of matches) {
      if (isSoldOutOccupancyMatch(match)) continue;
      if (match.matchClass !== "class_2" && match.matchClass !== "class_3") {
        continue;
      }
      const planRevenue = getMatchPlanRevenue(match);
      if (!(planRevenue > 0)) continue;
      let revenue = 0;
      for (const tx of transactions) {
        if (tx.stream !== "tickets" || tx.matchId !== match.id) continue;
        revenue += tx.amount;
      }
      if (!(revenue > 0)) continue;
      regular += 1;
      expect(
        revenue / planRevenue,
        `${match.id} ${match.matchClass} revenue fulfillment`,
      ).toBeLessThanOrEqual(MAX_REGULAR_TICKET_PLAN_FULFILLMENT + epsilon);
    }
    expect(regular).toBeGreaterThan(0);
  });

  it("keeps occupancy at least 96% when revenue/plan is over 95% and under 100%", () => {
    const epsilon = 1e-9;
    let highRevenue = 0;
    for (const match of matches) {
      if (!(match.capacity > 0)) continue;
      const planRevenue = getMatchPlanRevenue(match);
      if (!(planRevenue > 0)) continue;
      let revenue = 0;
      for (const tx of transactions) {
        if (tx.stream !== "tickets" || tx.matchId !== match.id) continue;
        revenue += tx.amount;
      }
      if (!(revenue > 0)) continue;
      const ratio = revenue / planRevenue;
      if (ratio <= HIGH_REVENUE_PLAN_THRESHOLD) continue;
      if (ratio >= OVER_PLAN_REVENUE_THRESHOLD) continue;
      highRevenue += 1;
      const occupancyMass = occupancyMassCapacity(match.capacity);
      const occupancy =
        (occupancyIssuedForMatch(match, transactions) +
          (redemptionsByMatch.get(match.id) ?? 0)) /
        occupancyMass;
      expect(
        occupancy,
        `${match.id} occupancy with high revenue/plan`,
      ).toBeGreaterThanOrEqual(MIN_HIGH_REVENUE_OCCUPANCY - epsilon);
    }
    expect(highRevenue).toBeGreaterThan(0);
  });

  it("keeps zone-sector match occupancy in the revenue/plan bands", () => {
    const epsilon = 0.05;
    const matchesById = new Map(matches.map((match) => [match.id, match]));
    const tree = buildZoneSectorTree({
      transactions,
      matchesById,
      localMatchIds: [],
      localPriceZones: [],
      localSectors: [],
      mode: "zones_to_sectors",
    });
    let mid = 0;
    let over = 0;
    for (const row of tree) {
      if (row.level !== "match" || row.kind === "dash") continue;
      if (row.revenue == null || row.planRevenue == null || !(row.planRevenue > 0)) {
        continue;
      }
      const ratio = row.revenue / row.planRevenue;
      expect(row.occupancy).not.toBeNull();
      expect(row.occupancy!).toBeLessThanOrEqual(100 + 1e-9);
      if (ratio >= OVER_PLAN_REVENUE_THRESHOLD) {
        over += 1;
        expect(
          row.occupancy,
          `${row.id} ${row.label} occupancy with revenue/plan ≥ 100%`,
        ).toBeGreaterThanOrEqual(MIN_OVER_PLAN_OCCUPANCY * 100 - epsilon);
        expect(formatPercent(row.occupancy!)).toBe(formatPercent(100));
      } else if (ratio > HIGH_REVENUE_PLAN_THRESHOLD) {
        expect(
          row.occupancy,
          `${row.id} ${row.label} occupancy with revenue/plan in (95%, 100%)`,
        ).toBeGreaterThanOrEqual(MIN_HIGH_REVENUE_OCCUPANCY * 100 - epsilon);
      } else if (ratio >= MID_REVENUE_PLAN_MIN) {
        mid += 1;
        expect(
          row.occupancy,
          `${row.id} ${row.label} occupancy with revenue/plan in [89%, 95%]`,
        ).toBeGreaterThanOrEqual(MID_REVENUE_PLAN_MIN * 100 - 1e-9);
        expect(row.occupancy!).toBeLessThanOrEqual(
          MAX_MID_REVENUE_OCCUPANCY * 100 + 1e-9,
        );
      }
    }
    expect(mid).toBeGreaterThan(0);
    expect(over).toBeGreaterThan(0);
  });

  it("sells merch at every completed match, including sold-out, and never at upcoming", () => {
    const merchByMatch = new Map<string, { revenue: number; receipts: number }>();
    for (const tx of transactions) {
      if (tx.stream !== "merch" || !tx.matchId) continue;
      const row = merchByMatch.get(tx.matchId) ?? { revenue: 0, receipts: 0 };
      if (tx.isReturn) {
        row.revenue -= tx.amount;
        row.receipts = Math.max(0, row.receipts - 1);
      } else {
        row.revenue += tx.amount;
        row.receipts += 1;
      }
      merchByMatch.set(tx.matchId, row);
    }

    const completed = matches.filter((match) => match.eventCompleted);
    const upcoming = matches.filter((match) => !match.eventCompleted);
    expect(completed.length).toBeGreaterThan(0);
    expect(upcoming.length).toBeGreaterThan(0);

    for (const match of completed) {
      const merch = merchByMatch.get(match.id);
      expect(merch, `${match.id} merch`).toBeDefined();
      expect(merch!.receipts, `${match.id} receipts`).toBeGreaterThan(0);
      expect(merch!.revenue, `${match.id} revenue`).toBeGreaterThan(0);
    }

    for (const match of upcoming) {
      expect(merchByMatch.has(match.id), `${match.id} upcoming merch`).toBe(
        false,
      );
    }
  });
});
