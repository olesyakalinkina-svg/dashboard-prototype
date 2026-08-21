"use client";

import { useFilterBarState } from "@/context/MobileFilterDraftContext";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Select } from "@/components/ui/Select";
import {
  ARENA_OPTIONS,
  EVENT_COMPLETED_OPTIONS,
  getMatchClassOptionsForStage,
  getSectorOptionsForPriceZone,
  arenaForSelectedLeague,
  isLeagueArenaLocked,
  LEAGUE_OPTIONS,
  NO_SECTORS_FILTER_VALUE,
  ORDER_SOURCE_OPTIONS,
  PRICE_ZONE_OPTIONS,
  sanitizeLeagueArena,
  sanitizeMatchClassForStage,
  sanitizeSectorsForPriceZone,
  SEASON_OPTIONS,
  TICKET_TYPE_OPTIONS,
  TOURNAMENT_STAGE_OPTIONS,
  NO_MATCHES_FILTER_VALUE,
  TREND_TIME_GROUPING_OPTIONS,
  getEffectiveTicketTimeGrouping,
  isTicketTimeGroupingRestrictedToDay,
} from "@/lib/ticket-filter-options";
import type {
  League,
  MatchClass,
  OrderSource,
  PriceZone,
  TicketFilters,
  TicketType,
  TimeGrouping,
  TournamentStage,
  ArenaId,
} from "@/types/dashboard";
import { ResponsiveFilterBar } from "@/components/layout/ResponsiveFilterBar";
import {
  clampDateRangeToBounds,
  getPurchaseDateBounds,
} from "@/lib/season-dates";
import { MOCK_TODAY } from "@/lib/mock/constants";
import { countActiveTicketFilters } from "@/lib/filter-count";
import { useMemo, type ReactNode } from "react";

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </p>
      <div className="grid grid-cols-1 gap-3 xl:flex xl:flex-wrap xl:items-end">
        {children}
      </div>
    </div>
  );
}

export function TicketsFilterBar() {
  const {
    ticketFilters,
    ticketMatchOptions,
    ticketSeriesOptions,
    setTicketFilters,
    resetTicketFilters,
  } = useFilterBarState();

  const activeFilterCount = useMemo(
    () => countActiveTicketFilters(ticketFilters),
    [ticketFilters],
  );

  function update<K extends keyof TicketFilters>(key: K, value: TicketFilters[K]) {
    setTicketFilters({ [key]: value });
  }

  const matchClassOptions = useMemo(
    () => getMatchClassOptionsForStage(ticketFilters.tournamentStage),
    [ticketFilters.tournamentStage],
  );

  const purchaseDateBounds = useMemo(
    () => getPurchaseDateBounds(ticketFilters.season),
    [ticketFilters.season],
  );

  const isParkingTicketType = ticketFilters.ticketType === "parking";
  const timeGroupingRestrictedToDay =
    isTicketTimeGroupingRestrictedToDay(ticketFilters);
  const effectiveTimeGrouping = getEffectiveTicketTimeGrouping(ticketFilters);
  const sectorOptions = useMemo(
    () => getSectorOptionsForPriceZone(ticketFilters.priceZone),
    [ticketFilters.priceZone],
  );
  const arenaLocked = isLeagueArenaLocked(ticketFilters.league);
  const arenaValue = sanitizeLeagueArena(
    ticketFilters.league,
    ticketFilters.arena,
  );

  return (
    <ResponsiveFilterBar
      onReset={resetTicketFilters}
      activeFilterCount={activeFilterCount}
    >
      <div className="space-y-3 sm:space-y-4">
      <FilterGroup title="Фильтры матчей">
        <Select
          label="Сезон"
          value={ticketFilters.season}
          onChange={(e) => {
            const season = e.target.value;
            setTicketFilters({
              season,
              transactionDateRange: clampDateRangeToBounds(
                ticketFilters.transactionDateRange,
                getPurchaseDateBounds(season),
              ),
            });
          }}
        >
          {SEASON_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          label="Лига"
          value={ticketFilters.league}
          onChange={(e) => {
            const league = e.target.value as League | "all";
            setTicketFilters({
              league,
              arena: arenaForSelectedLeague(league, ticketFilters.arena),
            });
          }}
        >
          {LEAGUE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          label="Этап турнира"
          value={ticketFilters.tournamentStage}
          onChange={(e) => {
            const tournamentStage = e.target.value as TournamentStage | "all";
            const matchClass = sanitizeMatchClassForStage(
              ticketFilters.matchClass,
              tournamentStage,
            );
            setTicketFilters({ tournamentStage, matchClass });
          }}
          className="xl:min-w-[160px]"
        >
          {TOURNAMENT_STAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          label="Класс матча"
          value={ticketFilters.matchClass}
          onChange={(e) =>
            update("matchClass", e.target.value as MatchClass | "all")
          }
          className="xl:min-w-[160px]"
        >
          {matchClassOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          label="Серия"
          value={ticketFilters.series}
          onChange={(e) => update("series", e.target.value)}
          className="xl:min-w-[160px]"
        >
          {ticketSeriesOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          label="Арена"
          value={arenaValue}
          onChange={(e) => update("arena", e.target.value as ArenaId | "all")}
          disabled={arenaLocked}
          className="xl:min-w-[180px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ARENA_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          label="Событие завершилось?"
          value={ticketFilters.eventCompleted}
          onChange={(e) =>
            update("eventCompleted", e.target.value as TicketFilters["eventCompleted"])
          }
        >
          {EVENT_COMPLETED_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <MultiSelect
          label="Матч"
          options={ticketMatchOptions}
          value={ticketFilters.matchId}
          onChange={(matchId) => update("matchId", matchId)}
          selectAllLabel="Все матчи"
          allSelectedLabel="Все матчи"
          emptyMeansAll
          applyOnClose
          noneValue={NO_MATCHES_FILTER_VALUE}
          className="xl:min-w-[220px]"
        />
      </FilterGroup>

      <FilterGroup title="Фильтры билетов">
        <Select
          label="Тип билета"
          value={ticketFilters.ticketType}
          onChange={(e) => {
            const ticketType = e.target.value as TicketType | "all";
            if (ticketType === "parking") {
              setTicketFilters({
                ticketType,
                priceZone: "all",
                sector: [],
              });
            } else {
              update("ticketType", ticketType);
            }
          }}
        >
          {TICKET_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          label="Ценовая зона"
          value={ticketFilters.priceZone}
          onChange={(e) => {
            const priceZone = e.target.value as PriceZone | "all";
            setTicketFilters({
              priceZone,
              sector: sanitizeSectorsForPriceZone(
                ticketFilters.sector,
                priceZone,
              ),
            });
          }}
          disabled={isParkingTicketType}
          className="disabled:cursor-not-allowed disabled:opacity-50"
        >
          {PRICE_ZONE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <MultiSelect
          label="Сектор"
          options={sectorOptions}
          value={ticketFilters.sector}
          onChange={(sector) => update("sector", sector)}
          selectAllLabel="Все секторы"
          allSelectedLabel="Все секторы"
          emptyMeansAll
          applyOnClose
          noneValue={NO_SECTORS_FILTER_VALUE}
          searchable
          searchPlaceholder="Поиск сектора..."
          disabled={isParkingTicketType}
          className="xl:min-w-[180px]"
        />

        <Select
          label="Источник заказа"
          value={ticketFilters.orderSource}
          onChange={(e) => update("orderSource", e.target.value as OrderSource | "all")}
          className="xl:min-w-[180px]"
        >
          {ORDER_SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <DateRangePicker
          label="Дата покупки"
          value={ticketFilters.transactionDateRange}
          onChange={(transactionDateRange) =>
            update(
              "transactionDateRange",
              clampDateRangeToBounds(transactionDateRange, purchaseDateBounds),
            )
          }
          minDate={purchaseDateBounds.min}
          maxDate={purchaseDateBounds.max}
          today={MOCK_TODAY}
          hideRangeFields
          className="xl:min-w-[220px]"
        />

        <div className="xl:ml-auto xl:shrink-0">
          <Select
            label="Группировка"
            value={effectiveTimeGrouping}
            onChange={(e) =>
              update("timeGrouping", e.target.value as TimeGrouping)
            }
          >
            {TREND_TIME_GROUPING_OPTIONS.map((opt) => (
              <option
                key={opt.value}
                value={opt.value}
                disabled={timeGroupingRestrictedToDay && opt.value !== "day"}
              >
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      </FilterGroup>
      </div>
    </ResponsiveFilterBar>
  );
}
