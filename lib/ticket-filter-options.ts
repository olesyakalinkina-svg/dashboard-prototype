import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type {
  ArenaId,
  League,
  Match,
  MatchClass,
  OrderSource,
  PriceZone,
  PriceZoneGroup,
  TicketFilters,
  TicketType,
  TimeGrouping,
  TournamentStage,
} from "@/types/dashboard";

export const ALL_PRICE_ZONES: PriceZone[] = [
  "A",
  "B1",
  "B2",
  "B3",
  "B4",
  "C1",
  "C2",
  "C3",
  "C4",
  "D1",
  "D2",
  "D3",
  "D4",
  "VIP",
];

export const ALL_PRICE_ZONE_GROUPS: PriceZoneGroup[] = [
  "A",
  "B",
  "C",
  "D",
  "VIP",
];

export function getPriceZoneGroup(zone: PriceZone): PriceZoneGroup {
  if (zone === "A" || zone === "VIP") return zone;
  if (zone.startsWith("B")) return "B";
  if (zone.startsWith("C")) return "C";
  return "D";
}

export const DEFAULT_TICKET_TRANSACTION_DATE_RANGE: TicketFilters["transactionDateRange"] =
  {
    from: null,
    to: null,
  };

/** Sentinel: explicit "no matches selected" (distinct from [] = all matches). */
export const NO_MATCHES_FILTER_VALUE = "__no_matches__";

export function isNoMatchesFilterValue(matchIds: string[]): boolean {
  return matchIds.length === 1 && matchIds[0] === NO_MATCHES_FILTER_VALUE;
}

export const DEFAULT_TICKET_FILTERS: TicketFilters = {
  season: "2025/26",
  league: "all",
  tournamentStage: "all",
  matchClass: "all",
  arena: "all",
  eventCompleted: "all",
  matchId: [],
  ticketType: "all",
  priceZone: "all",
  orderSource: "all",
  transactionDateRange: DEFAULT_TICKET_TRANSACTION_DATE_RANGE,
  timeGrouping: "month",
};

export function hasTransactionDateRangeFilter(
  transactionDateRange: TicketFilters["transactionDateRange"],
): boolean {
  return (
    transactionDateRange.from !== null || transactionDateRange.to !== null
  );
}

/**
 * Single-match ticket sales fit in ~10–16 days; monthly grouping collapses to
 * one bucket and Recharts cannot draw a line from a single point.
 * Purchase-date filter always uses daily buckets for meaningful trend lines.
 */
export function getEffectiveTicketTimeGrouping(
  ticketFilters: Pick<
    TicketFilters,
    "matchId" | "timeGrouping" | "transactionDateRange"
  >,
): TimeGrouping {
  if (hasTransactionDateRangeFilter(ticketFilters.transactionDateRange)) {
    return "day";
  }

  const singleMatchSelected =
    ticketFilters.matchId.length === 1 &&
    ticketFilters.matchId[0] !== NO_MATCHES_FILTER_VALUE;

  if (singleMatchSelected && ticketFilters.timeGrouping === "month") {
    return "day";
  }

  return ticketFilters.timeGrouping;
}

export function buildMatchFilterOptions(
  matchList: Match[],
): { value: string; label: string }[] {
  return matchList
    .slice()
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((match) => ({
      value: match.id,
      label: `vs ${match.opponent} · ${format(match.date, "d MMM yyyy", { locale: ru })}`,
    }));
}

export const SEASON_OPTIONS = [
  { value: "all", label: "Все сезоны" },
  { value: "2025/26", label: "2025/26" },
  { value: "2024/25", label: "2024/25" },
] as const;

const SEASON_ORDER = ["2024/25", "2025/26"] as const;

/** Returns the season immediately before `season`, or null if none exists. */
export function getPreviousSeason(season: string): string | null {
  const index = SEASON_ORDER.indexOf(season as (typeof SEASON_ORDER)[number]);
  if (index <= 0) return null;
  return SEASON_ORDER[index - 1];
}

export const LEAGUE_OPTIONS: { value: League | "all"; label: string }[] = [
  { value: "all", label: "Все лиги" },
  { value: "KHL", label: "КХЛ" },
  { value: "VHL", label: "ВХЛ" },
  { value: "MHL", label: "МХЛ" },
];

export const TOURNAMENT_STAGE_OPTIONS: {
  value: TournamentStage | "all";
  label: string;
}[] = [
  { value: "all", label: "Все этапы" },
  { value: "regular", label: "Регулярный чемпионат" },
  { value: "playoff", label: "Плей-офф" },
];

export const MATCH_CLASS_OPTIONS: { value: MatchClass | "all"; label: string }[] = [
  { value: "all", label: "Все классы" },
  { value: "class_1", label: "1 класс" },
  { value: "class_2", label: "2 класс" },
  { value: "class_3", label: "3 класс" },
  { value: "playoff", label: "Плей-офф" },
];

const REGULAR_MATCH_CLASSES = new Set<MatchClass>(["class_1", "class_2", "class_3"]);

/** Match class options available for the selected tournament stage. */
export function getMatchClassOptionsForStage(
  tournamentStage: TournamentStage | "all",
): { value: MatchClass | "all"; label: string }[] {
  if (tournamentStage === "regular") {
    return MATCH_CLASS_OPTIONS.filter(
      (opt) => opt.value === "all" || REGULAR_MATCH_CLASSES.has(opt.value as MatchClass),
    );
  }
  if (tournamentStage === "playoff") {
    return MATCH_CLASS_OPTIONS.filter((opt) => opt.value === "all" || opt.value === "playoff");
  }
  return MATCH_CLASS_OPTIONS;
}

/** Normalize match class when tournament stage changes. */
export function sanitizeMatchClassForStage(
  matchClass: MatchClass | "all",
  tournamentStage: TournamentStage | "all",
): MatchClass | "all" {
  if (tournamentStage === "playoff") {
    return "playoff";
  }
  if (tournamentStage === "regular" && matchClass === "playoff") {
    return "all";
  }
  if (matchClass === "all") return "all";
  const isValid = getMatchClassOptionsForStage(tournamentStage).some(
    (opt) => opt.value === matchClass,
  );
  return isValid ? matchClass : "all";
}

export const ARENA_OPTIONS: { value: ArenaId | "all"; label: string }[] = [
  { value: "all", label: "Все арены" },
  { value: "main", label: "Основная" },
  { value: "secondary", label: "Второстепенная" },
];

export const EVENT_COMPLETED_OPTIONS = [
  { value: "all", label: "Все" },
  { value: "yes", label: "Да" },
  { value: "no", label: "Нет" },
] as const;

export const TICKET_TYPE_OPTIONS: { value: TicketType | "all"; label: string }[] = [
  { value: "all", label: "Все" },
  { value: "parking", label: "Парковка" },
  { value: "arena", label: "Арена" },
];

export const PRICE_ZONE_OPTIONS: { value: PriceZone | "all"; label: string }[] = [
  { value: "all", label: "Все сектора" },
  ...ALL_PRICE_ZONES.map((zone) => ({ value: zone, label: zone })),
];

export const ORDER_SOURCE_OPTIONS: { value: OrderSource | "all"; label: string }[] = [
  { value: "all", label: "Все источники" },
  { value: "box_office", label: "Кассы" },
  { value: "official_site", label: "Официальный сайт" },
  { value: "yandex_afisha", label: "Яндекс-Афиша" },
];

export const TIME_GROUPING_OPTIONS: { value: TimeGrouping; label: string }[] = [
  { value: "day", label: "день" },
  { value: "week", label: "неделя" },
  { value: "month", label: "месяц" },
  { value: "quarter", label: "квартал" },
];

export const TIME_GROUPING_LABELS: Record<TimeGrouping, string> = {
  day: "Динамика выручки по дням",
  week: "Динамика выручки по неделям",
  month: "Динамика выручки по месяцам",
  quarter: "Динамика выручки по кварталам",
};

export const TICKET_TYPE_LABELS: Record<TicketType, string> = {
  parking: "Парковка",
  arena: "Арена",
};

export const ORDER_SOURCE_LABELS: Record<OrderSource, string> = {
  box_office: "Кассы",
  official_site: "Официальный сайт",
  yandex_afisha: "Яндекс-Афиша",
};

export const ALL_ORDER_SOURCES: OrderSource[] = [
  "box_office",
  "official_site",
  "yandex_afisha",
];

export const ORDER_SOURCE_COLORS: Record<OrderSource, string> = {
  box_office: "#5282FF",
  official_site: "#00BFA5",
  yandex_afisha: "#FF7043",
};

export const PRICE_ZONE_COLORS: Record<PriceZone, string> = {
  A: "#1E3A8A",
  B1: "#2563EB",
  B2: "#3B82F6",
  B3: "#60A5FA",
  B4: "#93C5FD",
  C1: "#065F46",
  C2: "#059669",
  C3: "#34D399",
  C4: "#6EE7B7",
  D1: "#7C2D12",
  D2: "#C2410C",
  D3: "#FB923C",
  D4: "#FDBA74",
  VIP: "#7C3AED",
};

export const PRICE_ZONE_GROUP_COLORS: Record<PriceZoneGroup, string> = {
  A: "#DC2626",
  B: "#0284C7",
  C: "#059669",
  D: "#C2410C",
  VIP: "#7C3AED",
};
