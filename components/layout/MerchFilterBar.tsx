"use client";

import { useFilters } from "@/context/FilterContext";
import { Button } from "@/components/ui/Button";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Select } from "@/components/ui/Select";
import {
  LEAGUE_OPTIONS,
  MERCH_SALES_POINT_OPTIONS,
  SEASON_OPTIONS,
  TIME_GROUPING_OPTIONS,
  TOURNAMENT_STAGE_OPTIONS,
} from "@/lib/merch-filter-options";
import type {
  League,
  MerchFilters,
  MerchSalesPoint,
  TimeGrouping,
  TournamentStage,
} from "@/types/dashboard";

export function MerchFilterBar() {
  const {
    merchFilters,
    merchMatchOptions,
    setMerchFilters,
    resetMerchFilters,
  } = useFilters();

  function update<K extends keyof MerchFilters>(key: K, value: MerchFilters[K]) {
    setMerchFilters({ [key]: value });
  }

  return (
    <div className="sticky top-0 z-10 border-b border-[var(--border)] bg-white px-6 py-4 shadow-sm">
      <div className="flex flex-wrap items-end gap-3">
        <Select
          label="Сезон"
          value={merchFilters.season}
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
          value={merchFilters.league}
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
          value={merchFilters.tournamentStage}
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
          label="Матч"
          value={merchFilters.matchId}
          onChange={(e) => update("matchId", e.target.value)}
          className="min-w-[220px]"
        >
          {merchMatchOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <MultiSelect
          label="Канал продаж"
          options={MERCH_SALES_POINT_OPTIONS}
          value={merchFilters.salesChannels}
          onChange={(value) =>
            update("salesChannels", value as MerchSalesPoint[])
          }
          className="min-w-[220px]"
        />

        <Select
          label="Группировка"
          value={merchFilters.timeGrouping}
          onChange={(e) => update("timeGrouping", e.target.value as TimeGrouping)}
        >
          {TIME_GROUPING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <Button variant="ghost" onClick={resetMerchFilters} className="mb-0.5">
          Сбросить
        </Button>
      </div>
    </div>
  );
}
