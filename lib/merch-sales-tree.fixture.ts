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

export const MERCH_FIXTURE_ARENA_TOP_PRODUCTS = [
  "Джерси игровое",
  "Футболка домашняя",
  "Свитшот с капюшоном",
  "Брелок клубный",
  "Значок клубный",
] as const;

export const MERCH_FIXTURE_ARENA_EXCLUDED_SKU = "Футболка гостевая";
export const MERCH_FIXTURE_NORTH_TOP_SKU = "Свитшот с капюшоном";

/** Arena-shop heavy, jerseys-heavy. Split into 7 SKUs so top-5 ranking is testable. */
const ARENA_SALES: Transaction[] = [
  merchTx("fx-m-a1", MERCH_FIXTURE_ARENA_MATCH_ID, ARENA_DATE, {
    amount: 180_000,
    quantity: 18,
    merchSalesPoint: "flagship",
    productCategory: "jerseys",
    description: "Джерси игровое",
  }),
  merchTx("fx-m-a2", MERCH_FIXTURE_ARENA_MATCH_ID, ARENA_DATE, {
    amount: 120_000,
    quantity: 12,
    merchSalesPoint: "flagship",
    productCategory: "jerseys",
    description: "Футболка домашняя",
  }),
  merchTx("fx-m-a3", MERCH_FIXTURE_ARENA_MATCH_ID, ARENA_DATE, {
    amount: 70_000,
    quantity: 7,
    merchSalesPoint: "flagship",
    productCategory: "jerseys",
    description: "Свитшот с капюшоном",
  }),
  merchTx("fx-m-a4", MERCH_FIXTURE_ARENA_MATCH_ID, ARENA_DATE, {
    amount: 30_000,
    quantity: 3,
    merchSalesPoint: "flagship",
    productCategory: "jerseys",
    description: "Футболка гостевая",
  }),
  merchTx("fx-m-a5", MERCH_FIXTURE_ARENA_MATCH_ID, ARENA_DATE, {
    amount: 45_000,
    quantity: 9,
    merchSalesPoint: "arena_north",
    productCategory: "souvenirs",
    description: "Брелок клубный",
  }),
  merchTx("fx-m-a6", MERCH_FIXTURE_ARENA_MATCH_ID, ARENA_DATE, {
    amount: 32_000,
    quantity: 7,
    merchSalesPoint: "arena_north",
    productCategory: "souvenirs",
    description: "Значок клубный",
  }),
  merchTx("fx-m-a7", MERCH_FIXTURE_ARENA_MATCH_ID, ARENA_DATE, {
    amount: 23_000,
    quantity: 4,
    merchSalesPoint: "arena_north",
    productCategory: "souvenirs",
    description: "Термокружка",
  }),
  merchTx("fx-m-a-mall", MERCH_FIXTURE_ARENA_MATCH_ID, ARENA_DATE, {
    amount: 50_000,
    quantity: 5,
    merchSalesPoint: "mall_raduga",
    productCategory: "apparel",
    description: "Шорты тренировочные",
  }),
];

/** North-kiosk heavy, apparel-heavy. Only 2 SKUs — both shown. */
const NORTH_SALES: Transaction[] = [
  merchTx("fx-m-b1", MERCH_FIXTURE_NORTH_MATCH_ID, NORTH_DATE, {
    amount: 80_000,
    quantity: 8,
    merchSalesPoint: "flagship",
    productCategory: "jerseys",
    description: "Джерси игровое",
  }),
  merchTx("fx-m-b2", MERCH_FIXTURE_NORTH_MATCH_ID, NORTH_DATE, {
    amount: 320_000,
    quantity: 32,
    merchSalesPoint: "arena_north",
    productCategory: "apparel",
    description: "Свитшот с капюшоном",
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
