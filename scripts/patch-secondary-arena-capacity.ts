/**
 * Rescales VHL / secondary-arena ticket (+parking) inventory in hockey-mock.json
 * from the previous 3000+360 bowl to 4000 seats + 800 parking. Leaves KHL, MHL,
 * merch transactions, and subscriptions untouched.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getSectorCapacitiesForMatch,
  splitSectorCapacity,
} from "../lib/arena-sector-inventory";
import { getMatchMerchPlanRevenue } from "../lib/merch-plan";
import { ALL_SECTORS, allowedPriceZonesForSector } from "../lib/ticket-filter-options";
import {
  applyMatchTicketPlanFulfillmentBand,
  getMatchPlanTickets,
  isSoldOutOccupancyMatch,
  MAX_MID_REVENUE_OCCUPANCY,
  maxMidRevenueOccupancyIssued,
  minMidRevenueOccupancyIssued,
  occupancyMassCapacity,
  PARKING_CAPACITY_SECONDARY,
  SECONDARY_ARENA_CAPACITY,
} from "../lib/ticket-plan";
import type { RawMockData } from "../lib/mock/revive-dates";
import type { Match, PriceZone, Sector } from "../types/dashboard";

const __dirname = dirname(fileURLToPath(import.meta.url));
const mockPath = join(__dirname, "../lib/mock/data/hockey-mock.json");

const PREV_SECONDARY_SEATS = 3000;
const PREV_SECONDARY_PARK = 360;

type RawTx = RawMockData["transactions"][number];
type RawMatch = RawMockData["matches"][number];

function issuedQty(tx: RawTx): number {
  const freeQty = tx.freeQuantity ?? (tx.amount === 0 ? tx.quantity : 0);
  return tx.amount > 0 ? freeQty + tx.quantity : freeQty;
}

function allocateToTarget(weights: number[], target: number): number[] {
  const sum = weights.reduce((total, value) => total + value, 0);
  if (target <= 0) return weights.map(() => 0);
  if (weights.length === 0) return [];
  if (sum <= 0) {
    const out = weights.map(() => 0);
    out[0] = target;
    return out;
  }
  const rows = weights.map((weight, index) => {
    const exact = (target * weight) / sum;
    const value = Math.floor(exact);
    return { index, value, frac: exact - value };
  });
  let leftover = target - rows.reduce((total, row) => total + row.value, 0);
  const ranked = [...rows].sort(
    (left, right) => right.frac - left.frac || left.index - right.index,
  );
  for (const row of ranked) {
    if (leftover <= 0) break;
    row.value += 1;
    leftover -= 1;
  }
  const out = Array(weights.length).fill(0);
  for (const row of rows) out[row.index] = row.value;
  return out;
}

function applyIssued(tx: RawTx, newIssued: number): void {
  const oldIssued = issuedQty(tx);
  if (newIssued === oldIssued) return;
  const oldQty = tx.quantity;
  const oldFree = tx.freeQuantity ?? (tx.amount === 0 ? tx.quantity : 0);
  if (tx.amount > 0) {
    const keepFree = Math.min(oldFree, Math.max(0, newIssued));
    const newQty = Math.max(0, newIssued - keepFree);
    if (oldQty > 0 && newQty !== oldQty) {
      tx.amount = Math.round((tx.amount * newQty) / oldQty);
      if (tx.loyaltyDiscount) {
        tx.loyaltyDiscount = Math.round((tx.loyaltyDiscount * newQty) / oldQty);
      }
    }
    tx.quantity = newQty;
    if (tx.freeQuantity != null) tx.freeQuantity = keepFree;
  } else {
    tx.quantity = newIssued;
    if (tx.freeQuantity != null) tx.freeQuantity = newIssued;
  }
}

function scaleTxsToIssued(txs: RawTx[], target: number): void {
  if (txs.length === 0) return;
  const allocated = allocateToTarget(txs.map(issuedQty), Math.max(0, target));
  for (let index = 0; index < txs.length; index += 1) {
    applyIssued(txs[index]!, allocated[index]!);
  }
}

function comboKey(sector: Sector, zone: PriceZone): string {
  return `${sector}|${zone}`;
}

function comboMasses(match: Pick<Match, "arena" | "league" | "capacity">) {
  const masses = new Map<string, number>();
  const sectors = getSectorCapacitiesForMatch(match);
  if (!sectors) return masses;
  for (const sector of ALL_SECTORS) {
    const cap = sectors[sector] ?? 0;
    if (!(cap > 0)) continue;
    const split = splitSectorCapacity(sector, cap);
    for (const zone of allowedPriceZonesForSector(sector)) {
      const mass = split[zone] ?? 0;
      if (mass > 0) masses.set(comboKey(sector, zone), mass);
    }
  }
  return masses;
}

function capArenaCombos(arenaTxs: RawTx[], match: Pick<Match, "arena" | "league" | "capacity">) {
  const masses = comboMasses(match);
  const groups = new Map<string, RawTx[]>();
  for (const tx of arenaTxs) {
    if (!tx.sector || !tx.priceZone) continue;
    const key = comboKey(tx.sector, tx.priceZone);
    const list = groups.get(key) ?? [];
    list.push(tx);
    groups.set(key, list);
  }
  let leftover = 0;
  const room = new Map<string, number>();
  for (const [key, mass] of masses) {
    const group = groups.get(key) ?? [];
    const issued = group.reduce((sum, tx) => sum + issuedQty(tx), 0);
    if (issued > mass) {
      scaleTxsToIssued(group, mass);
      leftover += issued - mass;
      room.set(key, 0);
    } else {
      room.set(key, mass - issued);
    }
  }
  if (leftover <= 0) return;
  const receivers = [...room.entries()].filter(([, extra]) => extra > 0);
  if (receivers.length === 0) return;
  const extras = allocateToTarget(
    receivers.map(([, extra]) => extra),
    Math.min(
      leftover,
      receivers.reduce((sum, [, extra]) => sum + extra, 0),
    ),
  );
  for (let index = 0; index < receivers.length; index += 1) {
    const add = extras[index] ?? 0;
    if (add <= 0) continue;
    const key = receivers[index]![0];
    const group = groups.get(key);
    if (group && group.length > 0) {
      scaleTxsToIssued(
        group,
        group.reduce((sum, tx) => sum + issuedQty(tx), 0) + add,
      );
    }
  }
}

function actualsForMatch(matchId: string, txs: RawTx[]) {
  let tickets = 0;
  let revenue = 0;
  let occupancyIssued = 0;
  let arenaRevenue = 0;
  let arenaIssued = 0;
  let parkingIssued = 0;
  for (const tx of txs) {
    if (tx.stream !== "tickets" || tx.matchId !== matchId) continue;
    tickets += tx.quantity;
    revenue += tx.amount;
    const issued = issuedQty(tx);
    occupancyIssued += issued;
    if (tx.ticketType === "parking") parkingIssued += issued;
    else {
      arenaRevenue += tx.amount;
      arenaIssued += issued;
    }
  }
  return { tickets, revenue, occupancyIssued, arenaRevenue, arenaIssued, parkingIssued };
}

const raw = JSON.parse(readFileSync(mockPath, "utf-8")) as RawMockData;
const vhlMatches = raw.matches.filter(
  (match) => match.league === "VHL" || match.arena === "secondary",
);
const vhlIds = new Set(vhlMatches.map((match) => match.id));

const txsByMatch = new Map<string, RawTx[]>();
for (const tx of raw.transactions) {
  if (tx.stream !== "tickets" || !tx.matchId || !vhlIds.has(tx.matchId)) continue;
  const list = txsByMatch.get(tx.matchId) ?? [];
  list.push(tx);
  txsByMatch.set(tx.matchId, list);
}

const newSeats = SECONDARY_ARENA_CAPACITY;
const newPark = PARKING_CAPACITY_SECONDARY;
const newMass = newSeats + newPark;
const summary: Array<{
  id: string;
  class: string;
  season: string;
  arenaIssued: number;
  parkingIssued: number;
  occupancyPct: string;
}> = [];

for (const match of vhlMatches) {
  const oldSeats = match.capacity > 0 ? match.capacity : PREV_SECONDARY_SEATS;
  const oldPark = PREV_SECONDARY_PARK;
  const oldMass = oldSeats + oldPark;
  const txs = txsByMatch.get(match.id) ?? [];
  const arenaTxs = txs.filter((tx) => tx.ticketType !== "parking");
  const parkingTxs = txs.filter((tx) => tx.ticketType === "parking");
  const oldArena = arenaTxs.reduce((sum, tx) => sum + issuedQty(tx), 0);
  const oldParking = parkingTxs.reduce((sum, tx) => sum + issuedQty(tx), 0);
  const oldIssued = oldArena + oldParking;
  const oldOcc = oldMass > 0 ? oldIssued / oldMass : 0;
  const soldOut = isSoldOutOccupancyMatch(match);

  if (
    match.merchPlanRevenue == null &&
    match.attendance > 0 &&
    match.capacity > 0
  ) {
    const stored = getMatchMerchPlanRevenue(match as unknown as Match);
    if (stored > 0) match.merchPlanRevenue = stored;
  }

  match.capacity = newSeats;
  match.arena = "secondary";
  if (match.attendance > 0) {
    match.attendance = Math.min(
      newSeats,
      Math.round((match.attendance * newSeats) / oldSeats),
    );
  }

  const arenaMax = soldOut
    ? newSeats
    : Math.floor(newSeats * MAX_MID_REVENUE_OCCUPANCY);
  let targetIssued = soldOut
    ? newMass
    : Math.round(oldOcc * newMass);
  if (!soldOut && oldOcc >= 0.89 - 1e-9 && oldOcc <= 0.96 + 1e-9) {
    targetIssued = Math.min(
      maxMidRevenueOccupancyIssued(newSeats),
      Math.max(minMidRevenueOccupancyIssued(newSeats), targetIssued),
    );
  }
  targetIssued = Math.min(newMass, Math.max(0, targetIssued));

  let targetArena = Math.min(
    arenaMax,
    Math.round((oldArena * newSeats) / oldSeats),
  );
  let targetParking = Math.min(newPark, Math.max(0, targetIssued - targetArena));
  if (targetArena + targetParking < targetIssued) {
    const missing = targetIssued - targetArena - targetParking;
    const parkRoom = newPark - targetParking;
    const parkAdd = Math.min(parkRoom, missing);
    targetParking += parkAdd;
    targetArena = Math.min(arenaMax, targetArena + (missing - parkAdd));
  }

  scaleTxsToIssued(arenaTxs, targetArena);
  capArenaCombos(arenaTxs, {
    arena: "secondary",
    league: "VHL",
    capacity: newSeats,
  });
  const arenaAfterCap = arenaTxs.reduce((sum, tx) => sum + issuedQty(tx), 0);
  if (arenaAfterCap < targetArena) {
    scaleTxsToIssued(arenaTxs, Math.min(targetArena, arenaMax));
    capArenaCombos(arenaTxs, {
      arena: "secondary",
      league: "VHL",
      capacity: newSeats,
    });
  }

  const arenaNow = arenaTxs.reduce((sum, tx) => sum + issuedQty(tx), 0);
  targetParking = Math.min(newPark, Math.max(0, targetIssued - arenaNow));
  if (parkingTxs.length > 0) {
    scaleTxsToIssued(parkingTxs, targetParking);
  }

  const planScale = newMass / oldMass;
  if (match.ticketPlanTickets != null && match.ticketPlanTickets > 0) {
    match.ticketPlanTickets = Math.round(match.ticketPlanTickets * planScale);
  }
  if (match.ticketPlanRevenue != null && match.ticketPlanRevenue > 0) {
    match.ticketPlanRevenue = Math.round(match.ticketPlanRevenue * planScale);
  }

  const actual = actualsForMatch(match.id, txs);
  applyMatchTicketPlanFulfillmentBand(match, actual);
  const ticketQtyCap = 1.04;
  if (actual.tickets > getMatchPlanTickets(match) * ticketQtyCap) {
    match.ticketPlanTickets = Math.ceil(actual.tickets / ticketQtyCap);
  }

  const occupancyPct =
    occupancyMassCapacity(match.capacity) > 0
      ? (
          (actual.occupancyIssued / occupancyMassCapacity(match.capacity)) *
          100
        ).toFixed(1)
      : "n/a";
  summary.push({
    id: match.id,
    class: match.matchClass,
    season: match.season,
    arenaIssued: actual.arenaIssued,
    parkingIssued: actual.parkingIssued,
    occupancyPct,
  });
}

writeFileSync(mockPath, JSON.stringify(raw));
console.log(
  `Patched ${vhlMatches.length} VHL/secondary matches in ${mockPath}`,
);
console.log(
  `  seats ${PREV_SECONDARY_SEATS}→${newSeats}, parking ${PREV_SECONDARY_PARK}→${newPark}, occupancy denom ${newMass}`,
);
for (const row of summary) {
  console.log(
    `  ${row.id} ${row.season} ${row.class} arena=${row.arenaIssued} park=${row.parkingIssued} occ=${row.occupancyPct}%`,
  );
}
