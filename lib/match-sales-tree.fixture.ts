import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import { formatTicketEventTitle } from "@/lib/format";
import {
  applyTicketSalesTransaction,
  createTicketSalesAgg,
  getTicketIssuedQuantity,
  isEmptyTicketSalesAgg,
  ticketSalesAvgPrice,
  ticketSalesLoyaltyDiscountPct,
} from "@/lib/ticket-sales-metrics";
import {
  DEFAULT_TICKET_FILTERS,
  NO_MATCHES_FILTER_VALUE,
} from "@/lib/ticket-filter-options";
import { getMatchPlanRevenue } from "@/lib/ticket-plan";
import { passesOrderDateRange } from "@/lib/season-dates";
import {
  buildSalesTree,
  type MatchSalesTreeNode,
} from "@/lib/match-sales-tree";
import type {
  DashboardFilters,
  Match,
  MatchSalesRow,
  OrderSource,
  PriceZone,
  TicketFilters,
  TicketType,
  Transaction,
} from "@/types/dashboard";

/** Frozen ids used by the confirm scenario (match + price zone). */
export const FIXTURE_CURRENT_MATCH_ID = "fx-khl-ska";
export const FIXTURE_PREV_MATCH_ID = "fx-khl-cska-prev";
export const FIXTURE_EMPTY_MATCH_ID = "fx-khl-empty";
export const FIXTURE_INCOMPLETE_MATCH_ID = "fx-mhl-incomplete";
export const CONFIRM_PRICE_ZONE: PriceZone = "from_1500_to_2500";

export const FIXTURE_DASHBOARD_FILTERS: DashboardFilters = {
  ...DEFAULT_DASHBOARD_FILTERS,
};

export const FIXTURE_TICKET_FILTERS: TicketFilters = {
  ...DEFAULT_TICKET_FILTERS,
  season: "all",
  league: "all",
};

function d(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 12, 0, 0);
}

export const FIXTURE_CURRENT_MATCH: Match = {
  id: FIXTURE_CURRENT_MATCH_ID,
  date: d(2025, 9, 15),
  opponent: "СКА",
  attendance: 9800,
  capacity: 12000,
  season: "2025/26",
  league: "KHL",
  tournamentStage: "regular",
  matchClass: "class_1",
  arena: "main",
  eventCompleted: true,
  ticketSalesWindowDays: 14,
};

export const FIXTURE_PREV_MATCH: Match = {
  id: FIXTURE_PREV_MATCH_ID,
  date: d(2024, 10, 20),
  opponent: "ЦСКА",
  attendance: 7200,
  capacity: 12000,
  season: "2024/25",
  league: "KHL",
  tournamentStage: "regular",
  matchClass: "class_2",
  arena: "main",
  eventCompleted: true,
  ticketSalesWindowDays: 12,
};

export const FIXTURE_EMPTY_MATCH: Match = {
  id: FIXTURE_EMPTY_MATCH_ID,
  date: d(2025, 10, 1),
  opponent: "Динамо",
  attendance: 0,
  capacity: 12000,
  season: "2025/26",
  league: "KHL",
  tournamentStage: "playoff",
  matchClass: "playoff",
  arena: "main",
  eventCompleted: false,
  ticketSalesWindowDays: 10,
};

export const FIXTURE_INCOMPLETE_MATCH: Match = {
  id: FIXTURE_INCOMPLETE_MATCH_ID,
  date: d(2025, 9, 20),
  opponent: "Локо",
  attendance: 0,
  capacity: 0,
  season: "2025/26",
  league: "MHL",
  tournamentStage: "regular",
  matchClass: "class_3",
  arena: "secondary",
  eventCompleted: true,
  ticketSalesWindowDays: 10,
};

export const FIXTURE_MATCHES: Match[] = [
  FIXTURE_CURRENT_MATCH,
  FIXTURE_PREV_MATCH,
  FIXTURE_EMPTY_MATCH,
  FIXTURE_INCOMPLETE_MATCH,
];

function ticketTx(
  id: string,
  matchId: string,
  date: Date,
  fields: {
    amount: number;
    quantity: number;
    ticketType?: TicketType;
    orderSource?: OrderSource;
    priceZone?: PriceZone;
    freeQuantity?: number;
    loyaltyDiscount?: number;
    sector?: Transaction["sector"];
    description?: string;
    isReturn?: boolean;
  },
): Transaction {
  return {
    id,
    date,
    stream: "tickets",
    description: fields.description ?? "Билет",
    matchId,
    channel: fields.ticketType === "parking" ? "arena" : "online",
    amount: fields.amount,
    quantity: fields.quantity,
    loyaltyDiscount: fields.loyaltyDiscount ?? 0,
    freeQuantity: fields.freeQuantity,
    ticketType: fields.ticketType,
    orderSource: fields.orderSource,
    priceZone: fields.priceZone,
    sector: fields.sector,
    isReturn: fields.isReturn,
  };
}

/**
 * Current-season match: arena+parking, all 3 sources, all 4 zones,
 * paid, free, loyalty discount, varied purchase dates.
 */
const CURRENT_SALES: Transaction[] = [
  ticketTx("fx-tx-a1", FIXTURE_CURRENT_MATCH_ID, d(2025, 9, 1), {
    amount: 10_000,
    quantity: 10,
    ticketType: "arena",
    orderSource: "box_office",
    priceZone: "up_to_1500",
    sector: "A",
  }),
  ticketTx("fx-tx-a2", FIXTURE_CURRENT_MATCH_ID, d(2025, 9, 5), {
    amount: 16_000,
    quantity: 8,
    ticketType: "arena",
    orderSource: "official_site",
    priceZone: "from_1500_to_2500",
    loyaltyDiscount: 2_000,
    sector: "B1",
  }),
  ticketTx("fx-tx-a3", FIXTURE_CURRENT_MATCH_ID, d(2025, 9, 8), {
    amount: 15_000,
    quantity: 5,
    ticketType: "arena",
    orderSource: "yandex_afisha",
    priceZone: "from_2500_to_4000",
    sector: "VIP",
  }),
  ticketTx("fx-tx-a4", FIXTURE_CURRENT_MATCH_ID, d(2025, 9, 10), {
    amount: 10_000,
    quantity: 2,
    ticketType: "arena",
    orderSource: "box_office",
    priceZone: "from_4000_to_6000",
    sector: "C1",
  }),
  ticketTx("fx-tx-a5", FIXTURE_CURRENT_MATCH_ID, d(2025, 9, 2), {
    amount: 0,
    quantity: 3,
    ticketType: "arena",
    orderSource: "box_office",
    priceZone: "up_to_1500",
    freeQuantity: 3,
    sector: "D1",
    description: "Бесплатный билет",
  }),
  ticketTx("fx-tx-a6", FIXTURE_CURRENT_MATCH_ID, d(2025, 9, 3), {
    amount: 2_000,
    quantity: 4,
    ticketType: "parking",
    orderSource: "official_site",
    description: "Парковка",
  }),
];

const PREV_SALES: Transaction[] = [
  ticketTx("fx-tx-b1", FIXTURE_PREV_MATCH_ID, d(2024, 10, 1), {
    amount: 12_000,
    quantity: 6,
    ticketType: "arena",
    orderSource: "box_office",
    priceZone: "from_1500_to_2500",
    sector: "A",
  }),
  ticketTx("fx-tx-b2", FIXTURE_PREV_MATCH_ID, d(2024, 10, 8), {
    amount: 12_000,
    quantity: 4,
    ticketType: "arena",
    orderSource: "official_site",
    priceZone: "from_2500_to_4000",
    sector: "B2",
  }),
];

const INCOMPLETE_SALES: Transaction[] = [
  ticketTx("fx-tx-d1", FIXTURE_INCOMPLETE_MATCH_ID, d(2025, 9, 12), {
    amount: 400,
    quantity: 1,
    ticketType: "parking",
    orderSource: "box_office",
    description: "Парковка без зоны",
  }),
];

/** Present in the source dump, never passed into the sales tree (cancelled excluded). */
export const FIXTURE_CANCELLED_TRANSACTIONS: Transaction[] = [
  ticketTx("fx-tx-cancelled", FIXTURE_CURRENT_MATCH_ID, d(2025, 9, 4), {
    amount: 8_000,
    quantity: 4,
    ticketType: "arena",
    orderSource: "yandex_afisha",
    priceZone: "from_1500_to_2500",
    description: "Отмена заказа",
  }),
];

/** Merch return — must not leak into the ticket sales tree. */
export const FIXTURE_MERCH_RETURN: Transaction = {
  id: "fx-tx-merch-return",
  date: d(2025, 9, 6),
  stream: "merch",
  description: "Возврат: шарф",
  matchId: FIXTURE_CURRENT_MATCH_ID,
  channel: "kiosk",
  amount: 1_500,
  quantity: 1,
  isReturn: true,
};

export const FIXTURE_SALES_TRANSACTIONS: Transaction[] = [
  ...CURRENT_SALES,
  ...PREV_SALES,
  ...INCOMPLETE_SALES,
];

export const FIXTURE_RAW_TRANSACTIONS: Transaction[] = [
  ...FIXTURE_SALES_TRANSACTIONS,
  ...FIXTURE_CANCELLED_TRANSACTIONS,
  FIXTURE_MERCH_RETURN,
];

export type FrozenMatchMetrics = {
  revenue: number;
  sold: number;
  free: number;
  issued: number;
  averagePrice: number;
  loyaltyDiscount: number;
  occupancyPercentage: number | null;
};

export const expectedMatchMetrics: FrozenMatchMetrics = {
  revenue: 53_000,
  sold: 29,
  free: 3,
  issued: 32,
  averagePrice: 53_000 / 29,
  loyaltyDiscount: 2_000,
  occupancyPercentage: (32 / 13_440) * 100,
};

export const expectedByTicketType: Record<TicketType, FrozenMatchMetrics> = {
  arena: {
    revenue: 51_000,
    sold: 25,
    free: 3,
    issued: 28,
    averagePrice: 51_000 / 25,
    loyaltyDiscount: 2_000,
    occupancyPercentage: null,
  },
  parking: {
    revenue: 2_000,
    sold: 4,
    free: 0,
    issued: 4,
    averagePrice: 2_000 / 4,
    loyaltyDiscount: 0,
    occupancyPercentage: null,
  },
};

export const expectedByOrderSource: Record<OrderSource, FrozenMatchMetrics> = {
  box_office: {
    revenue: 20_000,
    sold: 12,
    free: 3,
    issued: 15,
    averagePrice: 20_000 / 12,
    loyaltyDiscount: 0,
    occupancyPercentage: null,
  },
  official_site: {
    revenue: 18_000,
    sold: 12,
    free: 0,
    issued: 12,
    averagePrice: 18_000 / 12,
    loyaltyDiscount: 2_000,
    occupancyPercentage: null,
  },
  yandex_afisha: {
    revenue: 15_000,
    sold: 5,
    free: 0,
    issued: 5,
    averagePrice: 15_000 / 5,
    loyaltyDiscount: 0,
    occupancyPercentage: null,
  },
};

export const expectedByPriceZone: Record<PriceZone, FrozenMatchMetrics> = {
  up_to_1500: {
    revenue: 10_000,
    sold: 10,
    free: 3,
    issued: 13,
    averagePrice: 10_000 / 10,
    loyaltyDiscount: 0,
    occupancyPercentage: null,
  },
  from_1500_to_2500: {
    revenue: 16_000,
    sold: 8,
    free: 0,
    issued: 8,
    averagePrice: 16_000 / 8,
    loyaltyDiscount: 2_000,
    occupancyPercentage: null,
  },
  from_2500_to_4000: {
    revenue: 15_000,
    sold: 5,
    free: 0,
    issued: 5,
    averagePrice: 15_000 / 5,
    loyaltyDiscount: 0,
    occupancyPercentage: null,
  },
  from_4000_to_6000: {
    revenue: 10_000,
    sold: 2,
    free: 0,
    issued: 2,
    averagePrice: 10_000 / 2,
    loyaltyDiscount: 0,
    occupancyPercentage: null,
  },
};

export const expectedPrevMatchMetrics: FrozenMatchMetrics = {
  revenue: 24_000,
  sold: 10,
  free: 0,
  issued: 10,
  averagePrice: 24_000 / 10,
  loyaltyDiscount: 0,
    occupancyPercentage: (10 / 13_440) * 100,
};

export const expectedIncompleteMatchMetrics: FrozenMatchMetrics = {
  revenue: 400,
  sold: 1,
  free: 0,
  issued: 1,
  averagePrice: 400,
  loyaltyDiscount: 0,
  occupancyPercentage: null,
};

export const CONFIRM_SCENARIO = {
  matchId: FIXTURE_CURRENT_MATCH_ID,
  opponent: FIXTURE_CURRENT_MATCH.opponent,
  priceZone: CONFIRM_PRICE_ZONE,
  expected: expectedByPriceZone[CONFIRM_PRICE_ZONE],
} as const;

export function cloneTransactions(txs: Transaction[]): Transaction[] {
  return txs.map((tx) => ({ ...tx, date: new Date(tx.date.getTime()) }));
}

export function snapshotTransactions(txs: Transaction[]): string {
  return JSON.stringify(
    txs.map((tx) => ({
      ...tx,
      date: tx.date.toISOString(),
    })),
  );
}

export function metricsFromTransactions(txs: Transaction[]): FrozenMatchMetrics & {
  loyaltyDiscountPct: number;
} {
  const agg = createTicketSalesAgg();
  let issued = 0;
  for (const tx of txs) {
    applyTicketSalesTransaction(agg, tx);
    issued += getTicketIssuedQuantity(tx);
  }
  return {
    revenue: agg.revenue,
    sold: agg.ticketsSold,
    free: agg.freeTickets,
    issued,
    averagePrice: ticketSalesAvgPrice(agg),
    loyaltyDiscount: agg.loyaltyDiscount,
    occupancyPercentage: null,
    loyaltyDiscountPct: ticketSalesLoyaltyDiscountPct(agg),
  };
}

export function buildFixtureMatchRows(
  matches: Match[] = FIXTURE_MATCHES,
  txs: Transaction[] = FIXTURE_SALES_TRANSACTIONS,
): MatchSalesRow[] {
  const byMatch = new Map<string, Transaction[]>();
  for (const tx of txs) {
    if (!tx.matchId) continue;
    const list = byMatch.get(tx.matchId) ?? [];
    list.push(tx);
    byMatch.set(tx.matchId, list);
  }

  const rows: MatchSalesRow[] = [];
  for (const match of matches) {
    const matchTxs = byMatch.get(match.id) ?? [];
    const metrics = metricsFromTransactions(matchTxs);
    if (
      isEmptyTicketSalesAgg(
        {
          revenue: metrics.revenue,
          loyaltyDiscount: metrics.loyaltyDiscount,
          ticketsSold: metrics.sold,
          freeTickets: metrics.free,
        },
        metrics.issued,
      )
    ) {
      continue;
    }

    rows.push({
      matchId: match.id,
      eventLabel: formatTicketEventTitle(match),
      date: match.date,
      revenue: metrics.revenue,
      planRevenue: getMatchPlanRevenue(match),
      avgPrice: metrics.averagePrice,
      ticketsSold: metrics.sold,
      freeTickets: metrics.free,
      issuedTickets: metrics.issued,
      occupancyIssuedTickets: metrics.issued,
      capacity: match.capacity,
      loyaltyDiscountPct: metrics.loyaltyDiscountPct,
    });
  }

  return rows.sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function matchPassesTicketFilters(
  match: Match,
  ticketFilters: TicketFilters,
): boolean {
  if (ticketFilters.season !== "all" && match.season !== ticketFilters.season) {
    return false;
  }
  if (ticketFilters.league !== "all" && match.league !== ticketFilters.league) {
    return false;
  }
  if (
    ticketFilters.tournamentStage !== "all" &&
    match.tournamentStage !== ticketFilters.tournamentStage
  ) {
    return false;
  }
  if (
    ticketFilters.matchClass !== "all" &&
    match.matchClass !== ticketFilters.matchClass
  ) {
    return false;
  }
  if (ticketFilters.arena !== "all" && match.arena !== ticketFilters.arena) {
    return false;
  }
  if (ticketFilters.eventCompleted === "yes" && !match.eventCompleted) {
    return false;
  }
  if (ticketFilters.eventCompleted === "no" && match.eventCompleted) {
    return false;
  }
  if (ticketFilters.matchId.length === 0) return true;
  if (
    ticketFilters.matchId.length === 1 &&
    ticketFilters.matchId[0] === NO_MATCHES_FILTER_VALUE
  ) {
    return false;
  }
  return ticketFilters.matchId.includes(match.id);
}

export function txPassesTicketFilters(
  tx: Transaction,
  ticketFilters: TicketFilters,
): boolean {
  if (
    ticketFilters.ticketType !== "all" &&
    tx.ticketType !== ticketFilters.ticketType
  ) {
    return false;
  }
  if (
    ticketFilters.priceZone !== "all" &&
    tx.priceZone !== ticketFilters.priceZone
  ) {
    return false;
  }
  if (
    ticketFilters.orderSource !== "all" &&
    tx.orderSource !== ticketFilters.orderSource
  ) {
    return false;
  }
  if (!passesOrderDateRange(tx.date, ticketFilters.transactionDateRange)) {
    return false;
  }
  return true;
}

export type FixturePipelineResult = {
  matches: Match[];
  txs: Transaction[];
  rows: MatchSalesRow[];
  tree: MatchSalesTreeNode[];
};

/**
 * Local AND-across-dimensions / OR-within-matchId pipeline mirroring
 * `filterMatchesByTicketFilters` + `passesTicketFieldFilters`, without the
 * global mock store. Dashboard `dateRange` / `timeGrouping` are ignored
 * (same as `computeMatchSalesTable`).
 */
export function computeFixtureMatchSalesTable(
  _filters: DashboardFilters,
  ticketFilters: TicketFilters,
  matches: Match[] = FIXTURE_MATCHES,
  txs: Transaction[] = FIXTURE_SALES_TRANSACTIONS,
): FixturePipelineResult {
  const allowedMatches = matches.filter((match) =>
    matchPassesTicketFilters(match, ticketFilters),
  );
  const allowedIds = new Set(allowedMatches.map((match) => match.id));
  const filteredTxs = txs.filter(
    (tx) =>
      tx.stream === "tickets" &&
      tx.matchId != null &&
      allowedIds.has(tx.matchId) &&
      txPassesTicketFilters(tx, ticketFilters),
  );
  const rows = buildFixtureMatchRows(allowedMatches, filteredTxs);
  const tree = buildSalesTree(filteredTxs, rows, _filters, ticketFilters);
  return { matches: allowedMatches, txs: filteredTxs, rows, tree };
}

export function buildDefaultFixtureTree(): FixturePipelineResult {
  return computeFixtureMatchSalesTable(
    FIXTURE_DASHBOARD_FILTERS,
    FIXTURE_TICKET_FILTERS,
  );
}
