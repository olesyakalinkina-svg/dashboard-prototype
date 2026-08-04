import type {
  MerchFilters,
  MerchProductCategory,
  MerchSalesPoint,
  TimeGrouping,
  Transaction,
} from "@/types/dashboard";

export const ALL_MERCH_SALES_POINTS: MerchSalesPoint[] = [
  "flagship",
  "arena_north",
  "arena_south",
  "mall_raduga",
  "mall_continent",
  "online_store",
];

export const MERCH_SALES_POINT_LABELS: Record<MerchSalesPoint, string> = {
  flagship: "Флагманский магазин",
  arena_north: "Точка на арене — Север",
  arena_south: "Точка на арене — Юг",
  mall_raduga: "Точка в ТРК Радуга",
  mall_continent: "Точка в ТРК Континент",
  online_store: "Онлайн-магазин",
};

export const MERCH_SALES_POINT_OPTIONS = ALL_MERCH_SALES_POINTS.map((value) => ({
  value,
  label: MERCH_SALES_POINT_LABELS[value],
}));

export const ALL_MERCH_PRODUCT_CATEGORIES: MerchProductCategory[] = [
  "jerseys",
  "souvenirs",
  "drinkware",
  "apparel",
  "accessories",
];

export const MERCH_PRODUCT_CATEGORY_LABELS: Record<MerchProductCategory, string> = {
  jerseys: "Джерси и форма",
  souvenirs: "Сувениры",
  drinkware: "Посуда",
  apparel: "Одежда",
  accessories: "Аксессуары",
};

/** Maps legacy category keys from older mock data to the current taxonomy. */
export const LEGACY_MERCH_PRODUCT_CATEGORY_MAP: Record<string, MerchProductCategory> = {
  equipment: "jerseys",
  caps: "accessories",
  scarves: "accessories",
};

export const MERCH_PRODUCT_CATEGORY_OPTIONS = ALL_MERCH_PRODUCT_CATEGORIES.map(
  (value) => ({
    value,
    label: MERCH_PRODUCT_CATEGORY_LABELS[value],
  }),
);

export const MERCH_DESCRIPTION_CATEGORY_MAP: Record<string, MerchProductCategory> =
  {
    "Футболка домашняя": "jerseys",
    "Футболка гостевая": "jerseys",
    "Шарф клубный": "accessories",
    "Кепка с логотипом": "accessories",
    "Хоккейная клюшка mini": "jerseys",
    "Детская форма": "jerseys",
    "Термокружка": "drinkware",
    "Свитшот с капюшоном": "apparel",
    "Джерси игровое": "jerseys",
    "Шапка зимняя": "accessories",
    "Брелок клубный": "souvenirs",
    "Значок клубный": "souvenirs",
    "Носки хоккейные": "jerseys",
    "Рюкзак клубный": "accessories",
    "Плед с эмблемой": "accessories",
    "Кружка керамическая": "drinkware",
    "Автошторка": "accessories",
    "Варежки детские": "apparel",
    "Футболка поло": "jerseys",
    "Шорты тренировочные": "jerseys",
  };

export function getMerchProductCategory(
  tx: Pick<Transaction, "description" | "productCategory">,
): MerchProductCategory | null {
  if (tx.productCategory) {
    return (
      LEGACY_MERCH_PRODUCT_CATEGORY_MAP[tx.productCategory] ?? tx.productCategory
    );
  }
  const productName = tx.description.replace(/^Возврат:\s*/, "");
  return MERCH_DESCRIPTION_CATEGORY_MAP[productName] ?? null;
}

export const DEFAULT_MERCH_ORDER_DATE_RANGE: MerchFilters["orderDateRange"] = {
  from: null,
  to: null,
};

export const DEFAULT_MERCH_FILTERS: MerchFilters = {
  season: "all",
  league: "all",
  tournamentStage: "all",
  matchClass: "all",
  matchId: [],
  salesChannels: [...ALL_MERCH_SALES_POINTS],
  orderDateRange: DEFAULT_MERCH_ORDER_DATE_RANGE,
  timeGrouping: "month",
};

export const MERCH_TIME_GROUPING_LABELS: Record<TimeGrouping, string> = {
  day: "Динамика выручки от мерча по дням",
  week: "Динамика выручки от мерча по неделям",
  month: "Динамика выручки от мерча по месяцам",
  quarter: "Динамика выручки от мерча по кварталам",
};

export function getMerchSalesPointLabel(point?: MerchSalesPoint): string {
  if (!point) return "—";
  return MERCH_SALES_POINT_LABELS[point];
}

export {
  LEAGUE_OPTIONS,
  SEASON_OPTIONS,
  TIME_GROUPING_OPTIONS,
  TOURNAMENT_STAGE_OPTIONS,
  MATCH_CLASS_OPTIONS,
  buildMatchFilterOptions,
} from "@/lib/ticket-filter-options";
