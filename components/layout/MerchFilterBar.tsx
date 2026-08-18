"use client";

import { useMemo } from "react";
import { useFilterBarState } from "@/context/MobileFilterDraftContext";
import { NO_MATCHES_FILTER_VALUE } from "@/lib/ticket-filter-options";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Select } from "@/components/ui/Select";
import {
  LEAGUE_OPTIONS,
  MERCH_PRODUCT_CATEGORY_OPTIONS,
  MERCH_SALES_POINT_OPTIONS,
  TREND_TIME_GROUPING_OPTIONS,
  getEffectiveMerchTimeGrouping,
  getMatchClassOptionsForStage,
  isMerchTimeGroupingRestrictedToWeek,
  sanitizeMatchClassForStage,
  SEASON_OPTIONS,
  TOURNAMENT_STAGE_OPTIONS,
} from "@/lib/merch-filter-options";
import { ResponsiveFilterBar } from "@/components/layout/ResponsiveFilterBar";
import {
  clampDateRangeToBounds,
  getPurchaseDateBounds,
} from "@/lib/season-dates";
import { MOCK_TODAY } from "@/lib/mock/constants";
import { countActiveMerchFilters } from "@/lib/filter-count";
import type {
  League,
  MatchClass,
  MerchFilters,
  MerchProductCategory,
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
  } = useFilterBarState();

  const activeFilterCount = useMemo(
    () => countActiveMerchFilters(merchFilters),
    [merchFilters],
  );

  function update<K extends keyof MerchFilters>(key: K, value: MerchFilters[K]) {
    setMerchFilters({ [key]: value });
  }

  const matchClassOptions = useMemo(
    () => getMatchClassOptionsForStage(merchFilters.tournamentStage),
    [merchFilters.tournamentStage],
  );

  const purchaseDateBounds = useMemo(
    () => getPurchaseDateBounds(merchFilters.season),
    [merchFilters.season],
  );

  const timeGroupingRestrictedToWeek =
    isMerchTimeGroupingRestrictedToWeek(merchFilters);
  const effectiveTimeGrouping = getEffectiveMerchTimeGrouping(merchFilters);

  return (
    <ResponsiveFilterBar
      onReset={resetMerchFilters}
      activeFilterCount={activeFilterCount}
    >
      <div className="grid grid-cols-1 gap-3 xl:flex xl:flex-wrap xl:items-end">
        <Select
          label="Сезон"
          value={merchFilters.season}
          onChange={(e) => {
            const season = e.target.value;
            setMerchFilters({
              season,
              orderDateRange: clampDateRangeToBounds(
                merchFilters.orderDateRange,
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
          onChange={(e) => {
            const tournamentStage = e.target.value as TournamentStage | "all";
            const matchClass = sanitizeMatchClassForStage(
              merchFilters.matchClass,
              tournamentStage,
            );
            setMerchFilters({ tournamentStage, matchClass });
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
          value={merchFilters.matchClass}
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

        <MultiSelect
          label="Категория товара"
          options={MERCH_PRODUCT_CATEGORY_OPTIONS}
          value={merchFilters.productCategories}
          onChange={(value) =>
            update("productCategories", value as MerchProductCategory[])
          }
          selectAllLabel="Все категории"
          className="sm:min-w-[220px]"
        />

        <DateRangePicker
          label="Дата покупки"
          value={merchFilters.orderDateRange}
          onChange={(orderDateRange) =>
            update(
              "orderDateRange",
              clampDateRangeToBounds(orderDateRange, purchaseDateBounds),
            )
          }
          minDate={purchaseDateBounds.min}
          maxDate={purchaseDateBounds.max}
          today={MOCK_TODAY}
          hideRangeFields
          className="sm:min-w-[220px]"
        />

        <div className="sm:ml-auto sm:shrink-0">
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
                disabled={timeGroupingRestrictedToWeek && opt.value !== "week"}
              >
                {opt.label}
              </option>
            ))}
          </Select>
        </div>

      </div>
    </ResponsiveFilterBar>
  );
}
