"use client";

import { useFilters } from "@/context/FilterContext";
import { Select } from "@/components/ui/Select";
import {
  ARENA_OPTIONS,
  LEAGUE_OPTIONS,
  PRICE_ZONE_OPTIONS,
  SEASON_OPTIONS,
  TICKET_TYPE_OPTIONS,
  TOURNAMENT_STAGE_OPTIONS,
} from "@/lib/subscription-filter-options";
import { ResponsiveFilterBar } from "@/components/layout/ResponsiveFilterBar";
import type {
  ArenaId,
  League,
  PriceZone,
  SubscriptionFilters,
  TicketType,
  TournamentStage,
} from "@/types/dashboard";

export function SubscriptionsFilterBar() {
  const {
    subscriptionFilters,
    setSubscriptionFilters,
    resetSubscriptionFilters,
  } = useFilters();

  function update<K extends keyof SubscriptionFilters>(
    key: K,
    value: SubscriptionFilters[K],
  ) {
    setSubscriptionFilters({ [key]: value });
  }

  return (
    <ResponsiveFilterBar onReset={resetSubscriptionFilters}>
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

        <Select
          label="Ценовая зона"
          value={subscriptionFilters.priceZone}
          onChange={(e) => update("priceZone", e.target.value as PriceZone | "all")}
        >
          {PRICE_ZONE_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>
      </div>
    </ResponsiveFilterBar>
  );
}
