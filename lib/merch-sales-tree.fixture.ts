import { DEFAULT_DASHBOARD_FILTERS } from "@/lib/filter-coverage";
import { DEFAULT_MERCH_FILTERS } from "@/lib/merch-filter-options";
import {
  computeMerchSalesTree,
  type MerchSalesTreeNode,
} from "@/lib/merch-sales-tree";
import type {
  DashboardFilters,
  MerchFilters,
  MerchMatchSalesRow,
  MerchProductCategory,
  MerchSalesPoint,
  Transaction,
} from "@/types/dashboard";

export const MERCH_FIXTURE_ARENA_MATCH_ID = "fx-merch-ska";
export const MERCH_FIXTURE_NORTH_MATCH_ID = "fx-merch-cska";

export const FIXTURE_DASHBOARD_FILTERS: DashboardFilters = {
  ...DEFAULT_DASHBOARD_FILTERS,
};

export const FIXTURE_MERCH_FILTERS: MerchFilters = {
  ...DEFAULT_MERCH_FILTERS,
  season: "all",
  league: "all",
};

function d(year: number, monthIndex: number, day: number): Date {
  return new Date(year, monthIndex, day, 12, 0, 0);
}

function merchTx(
  id: string,
  matchId: string,
  date: Date,
  fields: {
    amount: number;
    quantity: number;
    merchSalesPoint: MerchSalesPoint;
    productCategory: MerchProductCategory;
    description?: string;
    isReturn?: boolean;
  },
): Transaction {
  return {
    id,
    date,
    stream: "merch",
    description: fields.description ?? "Футболка домашняя",
    matchId,
    channel: "kiosk",
    amount: fields.amount,
    quantity: fields.quantity,
    merchSalesPoint: fields.merchSalesPoint,
    productCategory: fields.productCategory,
    isReturn: fields.isReturn,
  };
}

const ARENA_DATE = d(2025, 9, 15);
const NORTH_DATE = d(2025, 8, 20);

/** Arena-shop heavy, jerseys-heavy. */
const ARENA_SALES: Transaction[] = [
  merchTx("fx-m-a1", MERCH_FIXTURE_ARENA_MATCH_ID, ARENA_DATE, {
    amount: 400_000,
    quantity: 40,
    merchSalesPoint: "flagship",
    productCategory: "jerseys",
  }),
  merchTx("fx-m-a2", MERCH_FIXTURE_ARENA_MATCH_ID, ARENA_DATE, {
    amount: 100_000,
    quantity: 20,
    merchSalesPoint: "arena_north",
    productCategory: "souvenirs",
  }),
  merchTx("fx-m-a-mall", MERCH_FIXTURE_ARENA_MATCH_ID, ARENA_DATE, {
    amount: 50_000,
    quantity: 5,
    merchSalesPoint: "mall_raduga",
    productCategory: "apparel",
  }),
];

/** North-kiosk heavy, apparel-heavy. */
const NORTH_SALES: Transaction[] = [
  merchTx("fx-m-b1", MERCH_FIXTURE_NORTH_MATCH_ID, NORTH_DATE, {
    amount: 80_000,
    quantity: 8,
    merchSalesPoint: "flagship",
    productCategory: "jerseys",
  }),
  merchTx("fx-m-b2", MERCH_FIXTURE_NORTH_MATCH_ID, NORTH_DATE, {
    amount: 320_000,
    quantity: 32,
    merchSalesPoint: "arena_north",
    productCategory: "apparel",
  }),
];

export const MERCH_FIXTURE_TRANSACTIONS: Transaction[] = [
  ...ARENA_SALES,
  ...NORTH_SALES,
];

export const MERCH_FIXTURE_MATCH_ROWS: MerchMatchSalesRow[] = [
  {
    matchId: MERCH_FIXTURE_ARENA_MATCH_ID,
    eventLabel: "vs СКА",
    date: ARENA_DATE,
    revenue: 500_000,
    planRevenue: 450_000,
    avgCheck: 250_000,
    receipts: 2,
    units: 60,
    upt: 30,
    attendance: 9800,
    purchaseConversionPct: (2 / 9800) * 100,
  },
  {
    matchId: MERCH_FIXTURE_NORTH_MATCH_ID,
    eventLabel: "vs ЦСКА",
    date: NORTH_DATE,
    revenue: 400_000,
    planRevenue: 500_000,
    avgCheck: 200_000,
    receipts: 2,
    units: 40,
    upt: 20,
    attendance: 7200,
    purchaseConversionPct: (2 / 7200) * 100,
  },
];

export function buildDefaultMerchFixtureTree(): {
  rows: MerchMatchSalesRow[];
  tree: MerchSalesTreeNode[];
  txs: Transaction[];
} {
  return {
    rows: MERCH_FIXTURE_MATCH_ROWS,
    txs: MERCH_FIXTURE_TRANSACTIONS,
    tree: computeMerchSalesTree(
      FIXTURE_DASHBOARD_FILTERS,
      FIXTURE_MERCH_FILTERS,
      MERCH_FIXTURE_MATCH_ROWS,
      { transactions: MERCH_FIXTURE_TRANSACTIONS },
    ),
  };
}
