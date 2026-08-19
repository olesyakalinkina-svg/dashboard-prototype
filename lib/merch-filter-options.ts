import type {
  MerchFilters,
  MerchProductCategory,
  MerchSalesGroup,
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

export const MERCH_SALES_POINT_COLORS: Record<MerchSalesPoint, string> = {
  flagship: "#7B61FF",
  arena_north: "#1976D2",
  arena_south: "#43A047",
  mall_raduga: "#FF7043",
  mall_continent: "#FFB300",
  online_store: "#00ACC1",
};

export const MERCH_SALES_POINT_OPTIONS = ALL_MERCH_SALES_POINTS.map((value) => ({
  value,
  label: MERCH_SALES_POINT_LABELS[value],
}));

/** Mall and online sales are not attributed to a match in «Продажи». */
export const MERCH_MATCH_TABLE_EXCLUDED_POINTS: ReadonlySet<MerchSalesPoint> =
  new Set(["online_store", "mall_raduga", "mall_continent"]);

export const MERCH_OFF_MATCH_SALES_POINTS: MerchSalesPoint[] =
  ALL_MERCH_SALES_POINTS.filter((point) =>
    MERCH_MATCH_TABLE_EXCLUDED_POINTS.has(point),
  );

export const MERCH_OFF_MATCH_ID = "off-match";
export const MERCH_OFF_MATCH_LABEL = "Продажи вне матча";

export function isMerchOffMatchId(matchId: string): boolean {
  return matchId === MERCH_OFF_MATCH_ID;
}

/** Keep «Продажи вне матча» after match rows; Итого stays a separate footer. */
export function pinMerchOffMatchLast<T extends { matchId: string }>(
  items: T[],
): T[] {
  const rest: T[] = [];
  const offMatch: T[] = [];
  for (const item of items) {
    if (isMerchOffMatchId(item.matchId)) offMatch.push(item);
    else rest.push(item);
  }
  return offMatch.length === 0 ? items : [...rest, ...offMatch];
}

export function isMerchOffMatchTablePoint(point?: MerchSalesPoint): boolean {
  return Boolean(point && MERCH_MATCH_TABLE_EXCLUDED_POINTS.has(point));
}

export function isMerchMatchTablePoint(point?: MerchSalesPoint): boolean {
  return !point || !MERCH_MATCH_TABLE_EXCLUDED_POINTS.has(point);
}

export const ALL_MERCH_SALES_GROUPS: MerchSalesGroup[] = ["arena", "trk", "online"];

export const MERCH_SALES_GROUP_CHANNELS: Record<
  MerchSalesGroup,
  MerchSalesPoint[]
> = {
  arena: ["flagship", "arena_north", "arena_south"],
  trk: ["mall_raduga", "mall_continent"],
  online: ["online_store"],
};

export const MERCH_SALES_GROUP_LABELS: Record<MerchSalesGroup, string> = {
  arena: "На арене",
  trk: "Точки ТРК",
  online: "Онлайн",
};

export const MERCH_SALES_GROUP_COLORS: Record<MerchSalesGroup, string> = {
  arena: "#00BFA5",
  trk: "#FF7043",
  online: "#7B61FF",
};

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
  season: "2025/26",
  league: "KHL",
  tournamentStage: "all",
  matchClass: "all",
  matchId: [],
  salesChannels: [...ALL_MERCH_SALES_POINTS],
  productCategories: [...ALL_MERCH_PRODUCT_CATEGORIES],
  orderDateRange: DEFAULT_MERCH_ORDER_DATE_RANGE,
  timeGrouping: "week",
};

export const MERCH_TIME_GROUPING_LABELS: Record<TimeGrouping, string> = {
  day: "Динамика выручки от мерча по дням",
  week: "Динамика выручки от мерча по неделям",
  month: "Динамика выручки от мерча по месяцам",
  quarter: "Динамика выручки от мерча по кварталам",
};

export function getEffectiveMerchTimeGrouping(
  merchFilters: Pick<MerchFilters, "tournamentStage" | "timeGrouping">,
): TimeGrouping {
  if (merchFilters.tournamentStage === "playoff") {
    return "week";
  }
  return merchFilters.timeGrouping;
}

export function isMerchTimeGroupingRestrictedToWeek(
  merchFilters: Pick<MerchFilters, "tournamentStage">,
): boolean {
  return merchFilters.tournamentStage === "playoff";
}

export function getMerchSalesPointLabel(point?: MerchSalesPoint): string {
  if (!point) return "—";
  return MERCH_SALES_POINT_LABELS[point];
}

export {
  LEAGUE_OPTIONS,
  SEASON_OPTIONS,
  TIME_GROUPING_OPTIONS,
  TREND_TIME_GROUPING_OPTIONS,
  TOURNAMENT_STAGE_OPTIONS,
  MATCH_CLASS_OPTIONS,
  getMatchClassOptionsForStage,
  sanitizeMatchClassForStage,
  buildMatchFilterOptions,
} from "@/lib/ticket-filter-options";
