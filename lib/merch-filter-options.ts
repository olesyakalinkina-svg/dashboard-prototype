import type { MerchFilters, MerchSalesPoint, TimeGrouping } from "@/types/dashboard";

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

export const DEFAULT_MERCH_FILTERS: MerchFilters = {
  season: "all",
  league: "all",
  tournamentStage: "all",
  matchId: "all",
  salesChannels: [...ALL_MERCH_SALES_POINTS],
  timeGrouping: "week",
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
  buildMatchFilterOptions,
} from "@/lib/ticket-filter-options";
