import { format } from "date-fns";
import { ru } from "date-fns/locale";
import type {
  ArenaId,
  League,
  Match,
  MatchClass,
  OrderSource,
  PriceZone,
  Sector,
  TicketFilters,
  TicketType,
  TimeGrouping,
  TournamentStage,
} from "@/types/dashboard";

export const ALL_SECTORS: Sector[] = [
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

export const SECTOR_OPTIONS: { value: Sector; label: string }[] = ALL_SECTORS.map(
  (sector) => ({ value: sector, label: sector }),
);

export const ALL_PRICE_ZONES: PriceZone[] = [
  "up_to_500",
  "from_500_to_1000",
  "from_1000_to_1500",
  "from_1500_to_2000",
  "from_2000_to_2500",
  "from_2500_to_3000",
];

export const NON_VIP_SECTORS: Sector[] = ALL_SECTORS.filter(
  (sector): sector is Exclude<Sector, "VIP"> => sector !== "VIP",
);

/** Ordinary sectors may sell in every remaining zone, including the top band. */
export const NON_VIP_PRICE_ZONES: PriceZone[] = [...ALL_PRICE_ZONES];

/** VIP seats use only the highest remaining band (3000). */
export const VIP_PRICE_ZONES: PriceZone[] = ["from_2500_to_3000"];

export const PRICE_ZONE_LABELS: Record<PriceZone, string> = {
  up_to_500: "500",
  from_500_to_1000: "1000",
  from_1000_to_1500: "1500",
  from_1500_to_2000: "2000",
  from_2000_to_2500: "2500",
  from_2500_to_3000: "3000",
};

/** Ordinary catalog prices stay at or below the top band. */
export const NON_VIP_MAX_UNIT_PRICE = 2999;
/** Inclusive VIP price band — the only allowed zone for that sector. */
export const VIP_MIN_UNIT_PRICE = 2500;
export const VIP_MAX_UNIT_PRICE = 3000;

function isVipPriceZone(zone: PriceZone): boolean {
  return VIP_PRICE_ZONES.includes(zone);
}

export function allowedPriceZonesForSector(sector: Sector): PriceZone[] {
  return sector === "VIP" ? [...VIP_PRICE_ZONES] : [...NON_VIP_PRICE_ZONES];
}

export function allowedSectorsForPriceZone(zone: PriceZone): Sector[] {
  return isVipPriceZone(zone) ? [...ALL_SECTORS] : [...NON_VIP_SECTORS];
}

export function isAllowedSectorPriceZone(
  sector: Sector,
  zone: PriceZone,
): boolean {
  if (sector === "VIP") return isVipPriceZone(zone);
  return NON_VIP_PRICE_ZONES.includes(zone);
}

/** Sentinel: explicit "no sectors selected" (distinct from [] = all sectors). */
export const NO_SECTORS_FILTER_VALUE = "__no_sectors__";

export function isNoSectorsFilterValue(sectors: readonly string[]): boolean {
  return sectors.length === 1 && sectors[0] === NO_SECTORS_FILTER_VALUE;
}

/**
 * Local widget filters have an allowed intersection when at least one
 * selected sector×zone pair exists in the matrix. Empty selections mean "all".
 * `NO_SECTORS_FILTER_VALUE` is an explicit empty selection, not "all".
 */
export function hasAllowedFilterIntersection(
  selectedZones: readonly PriceZone[],
  selectedSectors: readonly string[],
): boolean {
  if (isNoSectorsFilterValue(selectedSectors)) return false;
  const zones = selectedZones.length ? selectedZones : ALL_PRICE_ZONES;
  const sectors = selectedSectors.length
    ? (selectedSectors as Sector[])
    : ALL_SECTORS;
  return sectors.some((sector) =>
    zones.some((zone) => isAllowedSectorPriceZone(sector, zone)),
  );
}

export function visiblePriceZonesForFilters(
  selectedZones: readonly PriceZone[],
  selectedSectors: readonly string[],
): PriceZone[] {
  if (isNoSectorsFilterValue(selectedSectors)) return [];
  const zoneSet = selectedZones.length ? new Set(selectedZones) : null;
  const sectors = selectedSectors.length
    ? (selectedSectors as Sector[])
    : ALL_SECTORS;
  return ALL_PRICE_ZONES.filter((zone) => {
    if (zoneSet && !zoneSet.has(zone)) return false;
    return sectors.some((sector) => isAllowedSectorPriceZone(sector, zone));
  });
}

export function visibleSectorsForFilters(
  selectedZones: readonly PriceZone[],
  selectedSectors: readonly string[],
): Sector[] {
  if (isNoSectorsFilterValue(selectedSectors)) return [];
  const sectorSet = selectedSectors.length ? new Set(selectedSectors) : null;
  const zones = selectedZones.length ? selectedZones : ALL_PRICE_ZONES;
  return ALL_SECTORS.filter((sector) => {
    if (sectorSet && !sectorSet.has(sector)) return false;
    return zones.some((zone) => isAllowedSectorPriceZone(sector, zone));
  });
}

export function getSectorOptionsForPriceZone(
  priceZone: PriceZone | "all",
): { value: Sector; label: string }[] {
  const zones = priceZone === "all" ? [] : [priceZone];
  return visibleSectorsForFilters(zones, []).map((sector) => ({
    value: sector,
    label: sector,
  }));
}

export function sanitizeSectorsForPriceZone(
  sectors: readonly string[],
  priceZone: PriceZone | "all",
): string[] {
  if (isNoSectorsFilterValue(sectors)) return [NO_SECTORS_FILTER_VALUE];
  if (sectors.length === 0) return [];
  const allowed = new Set(
    getSectorOptionsForPriceZone(priceZone).map((opt) => opt.value),
  );
  const next = sectors.filter((sector) => allowed.has(sector as Sector));
  if (next.length === 0) return [NO_SECTORS_FILTER_VALUE];
  return next;
}

/** Empty selection means all seating sectors (same as match multi-select). */
export function hasActiveSectorFilter(sectors: readonly string[]): boolean {
  return sectors.length > 0;
}

export function passesSectorFilter(
  txSector: Sector | undefined,
  selected: readonly string[],
): boolean {
  if (selected.length === 0) return true;
  if (isNoSectorsFilterValue(selected)) return false;
  if (!txSector) return false;
  return selected.includes(txSector);
}

export function mergeTicketSectorFilters(
  globalSectors: readonly string[],
  localSectors: readonly string[],
): string[] {
  if (
    isNoSectorsFilterValue(globalSectors) ||
    isNoSectorsFilterValue(localSectors)
  ) {
    return [NO_SECTORS_FILTER_VALUE];
  }
  if (globalSectors.length === 0) return [...localSectors];
  if (localSectors.length === 0) return [...globalSectors];
  const allowed = new Set(globalSectors);
  const next = localSectors.filter((sector) => allowed.has(sector));
  return next.length > 0 ? next : [NO_SECTORS_FILTER_VALUE];
}

const PRICE_ZONE_MAX_EXCLUSIVE: Array<{ zone: PriceZone; maxExclusive: number }> =
  [
    { zone: "up_to_500", maxExclusive: 500 },
    { zone: "from_500_to_1000", maxExclusive: 1000 },
    { zone: "from_1000_to_1500", maxExclusive: 1500 },
    { zone: "from_1500_to_2000", maxExclusive: 2000 },
    { zone: "from_2000_to_2500", maxExclusive: 2500 },
  ];

export function priceZoneFromUnitPrice(unitPrice: number): PriceZone {
  for (const row of PRICE_ZONE_MAX_EXCLUSIVE) {
    if (unitPrice < row.maxExclusive) return row.zone;
  }
  return "from_2500_to_3000";
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
  league: "KHL",
  tournamentStage: "all",
  matchClass: "all",
  series: "all",
  arena: "all",
  eventCompleted: "all",
  matchId: [],
  ticketType: "all",
  priceZone: "all",
  sector: [],
  orderSource: "all",
  transactionDateRange: DEFAULT_TICKET_TRANSACTION_DATE_RANGE,
  timeGrouping: "week",
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

export const TREND_TIME_GROUPING_OPTIONS: { value: TimeGrouping; label: string }[] =
  [
    { value: "day", label: "Дни" },
    { value: "week", label: "Недели" },
    { value: "month", label: "Месяцы" },
  ];

export function isTicketTimeGroupingRestrictedToDay(
  ticketFilters: Pick<TicketFilters, "matchId" | "transactionDateRange">,
): boolean {
  if (hasTransactionDateRangeFilter(ticketFilters.transactionDateRange)) {
    return true;
  }

  const singleMatchSelected =
    ticketFilters.matchId.length === 1 &&
    ticketFilters.matchId[0] !== NO_MATCHES_FILTER_VALUE;

  return singleMatchSelected;
}

export function buildMatchFilterOptions(
  matchList: Match[],
): { value: string; label: string }[] {
  return matchList
    .slice()
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((match) => {
      const dateLabel = format(match.date, "d MMM yyyy", { locale: ru });
      const seriesLabel = match.series ? ` · ${match.series}` : "";
      return {
        value: match.id,
        label: `${match.opponent} · ${dateLabel}${seriesLabel}`,
      };
    });
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

/** Canonical KHL 2025/26 home-calendar series, in calendar order. */
export const KHL_SERIES_ORDER = [
  "Сентябрь",
  "Октябрь - 1",
  "Октябрь - 2",
  "Ноябрь - 1",
  "Ноябрь - 2",
  "Декабрь",
  "Январь - 1",
  "Январь - 2",
  "Февраль",
  "Февраль-Март",
  "ПО. Ак Барс",
] as const;

export const SERIES_ALL_OPTION = {
  value: "all" as const,
  label: "Все серии",
};

function seriesSortIndex(series: string): number {
  const index = KHL_SERIES_ORDER.indexOf(
    series as (typeof KHL_SERIES_ORDER)[number],
  );
  return index === -1 ? KHL_SERIES_ORDER.length : index;
}

/** Distinct series from the current match universe, plus «Все серии». */
export function buildSeriesFilterOptions(
  matchList: Match[],
): { value: string; label: string }[] {
  const present = new Set<string>();
  for (const match of matchList) {
    if (match.series) present.add(match.series);
  }
  const ordered = [...present].sort((left, right) => {
    const indexDelta = seriesSortIndex(left) - seriesSortIndex(right);
    if (indexDelta !== 0) return indexDelta;
    return left.localeCompare(right, "ru");
  });
  return [
    SERIES_ALL_OPTION,
    ...ordered.map((series) => ({ value: series, label: series })),
  ];
}

export function sanitizeSeriesForOptions(
  series: string | "all",
  options: readonly { value: string }[],
): string | "all" {
  if (series === "all") return "all";
  return options.some((opt) => opt.value === series) ? series : "all";
}

export function passesSeriesFilter(
  matchSeries: string | undefined,
  selected: string | "all",
): boolean {
  if (selected === "all") return true;
  return matchSeries === selected;
}

export const ARENA_OPTIONS: { value: ArenaId | "all"; label: string }[] = [
  { value: "all", label: "Все арены" },
  { value: "main", label: "Основная" },
  { value: "secondary", label: "Второстепенная" },
];

/**
 * Single-league home venue for ticket / match-sales / subscription filters.
 * VHL always plays on the secondary arena; MHL on the main arena.
 * KHL stays unlocked; selecting it defaults Arena to «Все арены».
 */
const LOCKED_LEAGUE_ARENA: Partial<Record<League, ArenaId>> = {
  VHL: "secondary",
  MHL: "main",
};

export function getLockedLeagueArena(
  league: League | "all",
): ArenaId | null {
  if (league === "all") return null;
  return LOCKED_LEAGUE_ARENA[league] ?? null;
}

export function isLeagueArenaLocked(league: League | "all"): boolean {
  return getLockedLeagueArena(league) !== null;
}

export function sanitizeLeagueArena(
  league: League | "all",
  arena: ArenaId | "all",
): ArenaId | "all" {
  return getLockedLeagueArena(league) ?? arena;
}

/** Arena to apply when the user (or a league-only patch) selects a league. */
export function arenaForSelectedLeague(
  league: League | "all",
  currentArena: ArenaId | "all",
): ArenaId | "all" {
  if (league === "KHL") return "all";
  return sanitizeLeagueArena(league, currentArena);
}

export function applyTicketFilterPatch(
  current: TicketFilters,
  patch: Partial<TicketFilters>,
): TicketFilters {
  const next = { ...current, ...patch };
  if (patch.league !== undefined && patch.arena === undefined) {
    next.arena = arenaForSelectedLeague(next.league, current.arena);
  } else {
    next.arena = sanitizeLeagueArena(next.league, next.arena);
  }
  return next;
}

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
  { value: "all", label: "Все зоны" },
  ...ALL_PRICE_ZONES.map((zone) => ({
    value: zone,
    label: PRICE_ZONE_LABELS[zone],
  })),
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
  up_to_500: "#DBEAFE",
  from_500_to_1000: "#93C5FD",
  from_1000_to_1500: "#60A5FA",
  from_1500_to_2000: "#3B82F6",
  from_2000_to_2500: "#2563EB",
  from_2500_to_3000: "#7C3AED",
};

export const SECTOR_COLORS: Record<Sector, string> = {
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

