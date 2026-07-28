"use client";

import { useFilters } from "@/context/FilterContext";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import {
  ARENA_OPTIONS,
  EVENT_COMPLETED_OPTIONS,
  LEAGUE_OPTIONS,
  ORDER_SOURCE_OPTIONS,
  PRICE_ZONE_OPTIONS,
  SEASON_OPTIONS,
  TICKET_TYPE_OPTIONS,
  TIME_GROUPING_OPTIONS,
  TOURNAMENT_STAGE_OPTIONS,
} from "@/lib/ticket-filter-options";
import type {
  League,
  OrderSource,
  PriceZone,
  TicketFilters,
  TicketType,
  TimeGrouping,
  TournamentStage,
  ArenaId,
} from "@/types/dashboard";
import type { ReactNode } from "react";

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
      <div className="flex flex-wrap items-end gap-3">{children}</div>
    </div>
  );
}

export function TicketsFilterBar() {
  const {
    ticketFilters,
    ticketMatchOptions,
    setTicketFilters,
    resetTicketFilters,
  } = useFilters();

  function update<K extends keyof TicketFilters>(key: K, value: TicketFilters[K]) {
    setTicketFilters({ [key]: value });
  }

  return (
    <div className="sticky top-0 z-10 space-y-4 border-b border-[var(--border)] bg-white px-6 py-4 shadow-sm">
      <FilterGroup title="Фильтры матчей">
        <Select
          label="Сезон"
          value={ticketFilters.season}
          onChange={(e) => update("season", e.target.value)}
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
          onChange={(e) =>
            update("tournamentStage", e.target.value as TournamentStage | "all")
          }
          className="min-w-[160px]"
        >
          {TOURNAMENT_STAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          label="Арена"
          value={ticketFilters.arena}
          onChange={(e) => update("arena", e.target.value as ArenaId | "all")}
          className="min-w-[180px]"
        >
          {ARENA_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          label="Событие"
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

        <Select
          label="Матч"
          value={ticketFilters.matchId}
          onChange={(e) => update("matchId", e.target.value)}
          className="min-w-[220px]"
        >
          {ticketMatchOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </FilterGroup>

      <FilterGroup title="Фильтры билетов">
        <Select
          label="Тип билета"
          value={ticketFilters.ticketType}
          onChange={(e) => update("ticketType", e.target.value as TicketType | "all")}
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
          className="min-w-[180px]"
        >
          {ORDER_SOURCE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          label="Группировка"
          value={ticketFilters.timeGrouping}
          onChange={(e) => update("timeGrouping", e.target.value as TimeGrouping)}
        >
          {TIME_GROUPING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Button variant="ghost" onClick={resetTicketFilters} className="mb-0.5">
          Сбросить
        </Button>
      </FilterGroup>
    </div>
  );
}
