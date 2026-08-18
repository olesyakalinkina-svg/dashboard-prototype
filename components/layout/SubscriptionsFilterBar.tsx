"use client";

import { useMemo } from "react";
import { useFilterBarState } from "@/context/MobileFilterDraftContext";
import { Select } from "@/components/ui/Select";
import {
  ARENA_OPTIONS,
  LEAGUE_OPTIONS,
  SEASON_OPTIONS,
  TICKET_TYPE_OPTIONS,
  TREND_TIME_GROUPING_OPTIONS,
  TOURNAMENT_STAGE_OPTIONS,
} from "@/lib/subscription-filter-options";
import { ResponsiveFilterBar } from "@/components/layout/ResponsiveFilterBar";
import { countActiveSubscriptionFilters } from "@/lib/filter-count";
import type {
  ArenaId,
  League,
  SubscriptionFilters,
  TicketType,
  TimeGrouping,
  TournamentStage,
} from "@/types/dashboard";

export function SubscriptionsFilterBar() {
  const {
    subscriptionFilters,
    setSubscriptionFilters,
    resetSubscriptionFilters,
  } = useFilterBarState();

  const activeFilterCount = useMemo(
    () => countActiveSubscriptionFilters(subscriptionFilters),
    [subscriptionFilters],
  );

  function update<K extends keyof SubscriptionFilters>(
    key: K,
    value: SubscriptionFilters[K],
  ) {
    setSubscriptionFilters({ [key]: value });
  }

  return (
    <ResponsiveFilterBar
      onReset={resetSubscriptionFilters}
      activeFilterCount={activeFilterCount}
    >
      <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <Select
          label="Сезон"
          value={subscriptionFilters.season}
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
          value={subscriptionFilters.league}
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
          value={subscriptionFilters.tournamentStage}
          onChange={(e) =>
            update("tournamentStage", e.target.value as TournamentStage | "all")
          }
          className="sm:min-w-[160px]"
        >
          {TOURNAMENT_STAGE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          label="Арена"
          value={subscriptionFilters.arena}
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
          label="Тип билета"
          value={subscriptionFilters.ticketType}
          onChange={(e) =>
            update("ticketType", e.target.value as TicketType | "all")
          }
        >
          {TICKET_TYPE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <div className="sm:ml-auto sm:shrink-0">
          <Select
            label="Группировка"
            value={subscriptionFilters.timeGrouping}
            onChange={(e) =>
              update("timeGrouping", e.target.value as TimeGrouping)
            }
          >
            {TREND_TIME_GROUPING_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </Select>
        </div>
      </div>
    </ResponsiveFilterBar>
  );
}
