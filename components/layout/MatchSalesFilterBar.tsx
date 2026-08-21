"use client";

import { useMemo } from "react";
import { useFilterBarState } from "@/context/MobileFilterDraftContext";
import { DateRangePicker } from "@/components/ui/DateRangePicker";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Select } from "@/components/ui/Select";
import {
  ARENA_OPTIONS,
  EVENT_COMPLETED_OPTIONS,
  getMatchClassOptionsForStage,
  arenaForSelectedLeague,
  isLeagueArenaLocked,
  LEAGUE_OPTIONS,
  sanitizeLeagueArena,
  sanitizeMatchClassForStage,
  SEASON_OPTIONS,
  TOURNAMENT_STAGE_OPTIONS,
  NO_MATCHES_FILTER_VALUE,
} from "@/lib/ticket-filter-options";
import { ResponsiveFilterBar } from "@/components/layout/ResponsiveFilterBar";
import {
  clampDateRangeToBounds,
  getPurchaseDateBounds,
} from "@/lib/season-dates";
import { MOCK_TODAY } from "@/lib/mock/constants";
import { countActiveMatchSalesFilters } from "@/lib/filter-count";
import type {
  ArenaId,
  League,
  MatchClass,
  MatchSalesFilters,
  TournamentStage,
} from "@/types/dashboard";

export function MatchSalesFilterBar() {
  const {
    matchSalesFilters,
    matchSalesMatchOptions,
    matchSalesSeriesOptions,
    setMatchSalesFilters,
    resetMatchSalesFilters,
  } = useFilterBarState();

  const activeFilterCount = useMemo(
    () => countActiveMatchSalesFilters(matchSalesFilters),
    [matchSalesFilters],
  );

  function update<K extends keyof MatchSalesFilters>(
    key: K,
    value: MatchSalesFilters[K],
  ) {
    setMatchSalesFilters({ [key]: value });
  }

  const matchClassOptions = useMemo(
    () => getMatchClassOptionsForStage(matchSalesFilters.tournamentStage),
    [matchSalesFilters.tournamentStage],
  );

  const purchaseDateBounds = useMemo(
    () => getPurchaseDateBounds(matchSalesFilters.season),
    [matchSalesFilters.season],
  );
  const arenaLocked = isLeagueArenaLocked(matchSalesFilters.league);
  const arenaValue = sanitizeLeagueArena(
    matchSalesFilters.league,
    matchSalesFilters.arena,
  );

  return (
    <ResponsiveFilterBar
      onReset={resetMatchSalesFilters}
      activeFilterCount={activeFilterCount}
    >
      <div className="grid grid-cols-1 gap-3 xl:flex xl:flex-wrap xl:items-end">
        <Select
          label="Сезон"
          value={matchSalesFilters.season}
          onChange={(e) => {
            const season = e.target.value;
            setMatchSalesFilters({
              season,
              purchaseDateRange: clampDateRangeToBounds(
                matchSalesFilters.purchaseDateRange,
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
          value={matchSalesFilters.league}
          onChange={(e) => {
            const league = e.target.value as League | "all";
            setMatchSalesFilters({
              league,
              arena: arenaForSelectedLeague(league, matchSalesFilters.arena),
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
          value={matchSalesFilters.tournamentStage}
          onChange={(e) => {
            const tournamentStage = e.target.value as TournamentStage | "all";
            const matchClass = sanitizeMatchClassForStage(
              matchSalesFilters.matchClass,
              tournamentStage,
            );
            setMatchSalesFilters({ tournamentStage, matchClass });
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
          value={matchSalesFilters.matchClass}
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
          value={matchSalesFilters.series}
          onChange={(e) => update("series", e.target.value)}
          className="xl:min-w-[160px]"
        >
          {matchSalesSeriesOptions.map((opt) => (
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
          value={matchSalesFilters.eventCompleted}
          onChange={(e) =>
            update(
              "eventCompleted",
              e.target.value as MatchSalesFilters["eventCompleted"],
            )
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
          options={matchSalesMatchOptions}
          value={matchSalesFilters.matchId}
          onChange={(matchId) => update("matchId", matchId)}
          selectAllLabel="Все матчи"
          allSelectedLabel="Все матчи"
          emptyMeansAll
          applyOnClose
          noneValue={NO_MATCHES_FILTER_VALUE}
          className="xl:min-w-[220px]"
        />

        <DateRangePicker
          label="Дата покупки"
          value={matchSalesFilters.purchaseDateRange}
          onChange={(purchaseDateRange) =>
            update(
              "purchaseDateRange",
              clampDateRangeToBounds(purchaseDateRange, purchaseDateBounds),
            )
          }
          minDate={purchaseDateBounds.min}
          maxDate={purchaseDateBounds.max}
          today={MOCK_TODAY}
          hideRangeFields
          className="xl:min-w-[220px]"
        />
      </div>
    </ResponsiveFilterBar>
  );
}
