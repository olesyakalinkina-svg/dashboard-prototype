import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type {
  ArenaId,
  League,
  Match,
  MatchClass,
  OrderSource,
  PriceZone,
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

export const DEFAULT_TICKET_FILTERS: TicketFilters = {
  season: "2025/26",
  league: "all",
  tournamentStage: "all",
  matchClass: "all",
  arena: "all",
  eventCompleted: "all",
  matchId: "all",
  ticketType: "all",
  priceZone: "all",
  orderSource: "all",
  timeGrouping: "week",
};

export function buildMatchFilterOptions(
  matchList: Match[],
): { value: string; label: string }[] {
  return [
    { value: "all", label: "Все матчи" },
    ...matchList
      .slice()
      .sort((a, b) => b.date.getTime() - a.date.getTime())
      .map((match) => ({
        value: match.id,
        label: `vs ${match.opponent} · ${format(match.date, "d MMM yyyy", { locale: ru })}`,
      })),
  ];
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
  { value: "regular", label: "Обычный" },
  { value: "derby", label: "Дерби" },
  { value: "special", label: "Спецматч" },
];

export const ARENA_OPTIONS: { value: ArenaId | "all"; label: string }[] = [
  { value: "all", label: "Все арены" },
  { value: "main", label: "Основная" },
  { value: "secondary", label: "Второстепенная" },
];

export const EVENT_COMPLETED_OPTIONS = [
  { value: "all", label: "Все события" },
  { value: "yes", label: "Свершилось" },
  { value: "no", label: "Не свершилось" },
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
