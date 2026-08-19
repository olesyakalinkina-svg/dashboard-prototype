"use client";

import { useMemo } from "react";
import { useFilterBarState } from "@/context/MobileFilterDraftContext";
import { Select } from "@/components/ui/Select";
import {
  ARENA_OPTIONS,
  LEAGUE_OPTIONS,
  SEASON_OPTIONS,
  SUBSCRIPTION_PRICE_CATEGORY_OPTIONS,
  TREND_TIME_GROUPING_OPTIONS,
  isSubscriptionArenaLocked,
  sanitizeSubscriptionArena,
} from "@/lib/subscription-filter-options";
import { ResponsiveFilterBar } from "@/components/layout/ResponsiveFilterBar";
import { countActiveSubscriptionFilters } from "@/lib/filter-count";
import type {
  ArenaId,
  League,
  SubscriptionFilters,
  SubscriptionPriceCategory,
  TimeGrouping,
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
  const arenaLocked = isSubscriptionArenaLocked(subscriptionFilters.league);
  const arenaValue = sanitizeSubscriptionArena(
    subscriptionFilters.league,
    subscriptionFilters.arena,
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
      <div className="grid grid-cols-1 gap-3 xl:flex xl:flex-wrap xl:items-end">
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
          onChange={(e) => {
            const league = e.target.value as League | "all";
            setSubscriptionFilters({
              league,
              arena: sanitizeSubscriptionArena(league, subscriptionFilters.arena),
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
          label="Арена"
          value={arenaValue}
          onChange={(e) => update("arena", e.target.value as ArenaId | "all")}
          disabled={arenaLocked}
          className="sm:min-w-[180px] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {ARENA_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Select
          label="Тип продукта"
          value={subscriptionFilters.priceCategory}
          onChange={(e) =>
            update(
              "priceCategory",
              e.target.value as SubscriptionPriceCategory | "all",
            )
          }
        >
          {SUBSCRIPTION_PRICE_CATEGORY_OPTIONS.map((opt) => (
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
