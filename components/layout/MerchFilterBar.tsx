"use client";

import { useFilters } from "@/context/FilterContext";
import { NO_MATCHES_FILTER_VALUE } from "@/lib/ticket-filter-options";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Select } from "@/components/ui/Select";
import {
  LEAGUE_OPTIONS,
  MERCH_SALES_POINT_OPTIONS,
  MATCH_CLASS_OPTIONS,
  SEASON_OPTIONS,
  TIME_GROUPING_OPTIONS,
  TOURNAMENT_STAGE_OPTIONS,
} from "@/lib/merch-filter-options";
import { ResponsiveFilterBar } from "@/components/layout/ResponsiveFilterBar";
import type {
  League,
  MatchClass,
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
    <ResponsiveFilterBar onReset={resetMerchFilters}>
      <div className="grid grid-cols-1 gap-3 sm:flex sm:flex-wrap sm:items-end">
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
          value={merchFilters.matchClass}
          onChange={(e) =>
            update("matchClass", e.target.value as MatchClass | "all")
          }
          className="sm:min-w-[160px]"
        >
          {MATCH_CLASS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

        <MultiSelect
          label="Матч"
          options={merchMatchOptions}
          value={merchFilters.matchId}
          onChange={(matchId) => update("matchId", matchId)}
          selectAllLabel="Все матчи"
          allSelectedLabel="Все матчи"
          emptyMeansAll
          applyOnClose
          noneValue={NO_MATCHES_FILTER_VALUE}
          className="sm:min-w-[220px]"
        />

        <MultiSelect
          label="Канал продаж"
          options={MERCH_SALES_POINT_OPTIONS}
          value={merchFilters.salesChannels}
          onChange={(value) =>
            update("salesChannels", value as MerchSalesPoint[])
          }
          className="sm:min-w-[220px]"
        />

        <DateRangePicker
          label="Дата заказа"
          value={merchFilters.orderDateRange}
          onChange={(orderDateRange) => update("orderDateRange", orderDateRange)}
          className="sm:min-w-[220px]"
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

      </div>
    </ResponsiveFilterBar>
  );
}
