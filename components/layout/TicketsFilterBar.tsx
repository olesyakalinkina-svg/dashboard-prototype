"use client";

import { useFilterState } from "@/context/FilterContext";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Select } from "@/components/ui/Select";
import {
  ARENA_OPTIONS,
  EVENT_COMPLETED_OPTIONS,
  getMatchClassOptionsForStage,
  LEAGUE_OPTIONS,
  ORDER_SOURCE_OPTIONS,
  PRICE_ZONE_OPTIONS,
  sanitizeMatchClassForStage,
  SEASON_OPTIONS,
  TICKET_TYPE_OPTIONS,
  TOURNAMENT_STAGE_OPTIONS,
  NO_MATCHES_FILTER_VALUE,
} from "@/lib/ticket-filter-options";
import type {
  League,
  MatchClass,
  OrderSource,
  PriceZone,
  TicketFilters,
  TicketType,
  TournamentStage,
  ArenaId,
} from "@/types/dashboard";
import { ResponsiveFilterBar } from "@/components/layout/ResponsiveFilterBar";
import {
  clampDateRangeToBounds,
  getPurchaseDateBounds,
} from "@/lib/season-dates";
import { MOCK_TODAY } from "@/lib/mock/hockey";
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
      <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">{children}</div>
    </div>
  );
}

export function TicketsFilterBar() {
  const {
    ticketFilters,
    ticketMatchOptions,
    setTicketFilters,
    resetTicketFilters,
  } = useFilterState();

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

  return (
    <ResponsiveFilterBar onReset={resetTicketFilters}>
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
          onChange={(e) => update("league", e.target.value as League | "all")}
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
          className="sm:min-w-[160px]"
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
          className="sm:min-w-[160px]"
        >
          {matchClassOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          label="Арена"
          value={ticketFilters.arena}
          onChange={(e) => update("arena", e.target.value as ArenaId | "all")}
          className="sm:min-w-[180px]"
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
          className="sm:min-w-[220px]"
        />
      </FilterGroup>

      <FilterGroup title="Фильтры билетов">
        <Select
          label="Тип билета"
          value={ticketFilters.ticketType}
          onChange={(e) => {
            const ticketType = e.target.value as TicketType | "all";
            if (ticketType === "parking") {
              setTicketFilters({ ticketType, priceZone: "all" });
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
          onChange={(e) => update("priceZone", e.target.value as PriceZone | "all")}
          disabled={isParkingTicketType}
          className="disabled:cursor-not-allowed disabled:opacity-50"
        >
          {PRICE_ZONE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          label="Источник заказа"
          value={ticketFilters.orderSource}
          onChange={(e) => update("orderSource", e.target.value as OrderSource | "all")}
          className="sm:min-w-[180px]"
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
          className="sm:min-w-[220px]"
        />
      </FilterGroup>
      </div>
    </ResponsiveFilterBar>
  );
}
