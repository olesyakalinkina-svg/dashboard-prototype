"use client";

import clsx from "clsx";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Select } from "@/components/ui/Select";
import { useFilterData } from "@/context/FilterContext";
import {
  ALL_PRICE_ZONES,
  ALL_SECTORS,
  PRICE_ZONE_LABELS,
} from "@/lib/ticket-filter-options";
import { filterMatchesByTicketFilters, filterTicketTransactions } from "@/lib/filters";
import {
  buildAvailabilityIndex,
  buildMatrixRows,
  computeOccupancy,
  inferChildSectorsForZone,
  inferChildZonesForSector,
  preAggregateZoneSector,
  type ComparisonSlice,
  type DetailMode,
  type ZoneSectorMetric,
} from "@/lib/tickets-zone-sector-analytics";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/format";
import type { PriceZone, Sector } from "@/types/dashboard";

const MATRIX_ZONE_HEADERS: Record<PriceZone, string> = {
  up_to_1500: "до 1 500 ₽",
  from_1500_to_2500: "1 500–2 500 ₽",
  from_2500_to_4000: "2 500–4 000 ₽",
  from_4000_to_6000: "4 000–6 000 ₽",
};

const SLICE_OPTIONS: Array<{ value: ComparisonSlice; label: string }> = [
  { value: "current", label: "Текущее состояние" },
  { value: "days_before_1", label: "За 1 день до матча" },
  { value: "days_before_3", label: "За 3 дня до матча" },
  { value: "days_before_7", label: "За 7 дней до матча" },
  { value: "days_before_14", label: "За 14 дней до матча" },
  { value: "days_before_30", label: "За 30 дней до матча" },
  { value: "final", label: "Итоговые продажи" },
];

const METRIC_LABELS: Record<ZoneSectorMetric, string> = {
  occupancy: "Заполняемость",
  sold: "Продано",
  revenue: "Выручка",
  avgPrice: "Средняя цена",
};

function metricValue(
  metric: ZoneSectorMetric,
  args: { sold: number; issued: number; revenue: number; occupancy: number | null },
): number | null {
  if (metric === "sold") return args.sold;
  if (metric === "revenue") return args.revenue;
  if (metric === "avgPrice") return args.sold > 0 ? args.revenue / args.sold : null;
  return args.occupancy;
}

function formatMetric(metric: ZoneSectorMetric, value: number | null): string {
  if (value == null) return "—";
  if (metric === "occupancy") return formatPercent(value);
  if (metric === "revenue" || metric === "avgPrice") return formatCurrency(value);
  return `${formatNumber(value)} шт`;
}

function heatClass(ratio: number | null): string {
  if (ratio == null) return "bg-white";
  if (ratio >= 0.8) return "bg-blue-600 text-white";
  if (ratio >= 0.6) return "bg-blue-500 text-white";
  if (ratio >= 0.4) return "bg-blue-300";
  if (ratio >= 0.2) return "bg-blue-200";
  return "bg-blue-100";
}

export function TicketsZoneSectorWidget() {
  const { appliedFilters, appliedTicketFilters } = useFilterData();
  const transactions = useMemo(
    () => filterTicketTransactions(appliedFilters, appliedTicketFilters),
    [appliedFilters, appliedTicketFilters],
  );
  const matches = useMemo(
    () => filterMatchesByTicketFilters(appliedTicketFilters),
    [appliedTicketFilters],
  );
  const matchesById = useMemo(() => new Map(matches.map((m) => [m.id, m])), [matches]);
  const [metric, setMetric] = useState<ZoneSectorMetric>("occupancy");
  const [slice, setSlice] = useState<ComparisonSlice>("current");
  const [mode, setMode] = useState<DetailMode>("zones_to_sectors");
  const [selectedMatchIds, setSelectedMatchIds] = useState<string[]>([]);
  const [selectedZoneIds, setSelectedZoneIds] = useState<PriceZone[]>([]);
  const [selectedSectorIds, setSelectedSectorIds] = useState<Sector[]>([]);
  const [selectedCell, setSelectedCell] = useState<{
    matchId: string;
    zoneId: PriceZone;
  } | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set());
  const [sortByZone, setSortByZone] = useState<{
    zoneId: PriceZone | null;
    direction: "asc" | "desc" | null;
  }>({ zoneId: null, direction: null });
  const [invalidHint, setInvalidHint] = useState<string | null>(null);
  const [openLatencyMs, setOpenLatencyMs] = useState<number[]>([]);
  const [openStartedAt, setOpenStartedAt] = useState<number | null>(null);

  const allAgg = useMemo(
    () => preAggregateZoneSector(transactions, matchesById, "current"),
    [transactions, matchesById],
  );
  const availability = useMemo(() => buildAvailabilityIndex(allAgg), [allAgg]);

  const matrixRows = useMemo(
    () =>
      buildMatrixRows({
        transactions,
        matchesById,
        localMatchIds: selectedMatchIds,
        localPriceZones: selectedZoneIds,
        localSectors: selectedSectorIds,
        slice,
      }),
    [transactions, matchesById, selectedMatchIds, selectedZoneIds, selectedSectorIds, slice],
  );

  const existingMatchIds = useMemo(() => new Set(matrixRows.map((row) => row.matchId)), [matrixRows]);

  useEffect(() => {
    const stale = selectedMatchIds.filter((id) => !existingMatchIds.has(id));
    if (stale.length) {
      setSelectedMatchIds((prev) => prev.filter((id) => existingMatchIds.has(id)));
      setInvalidHint("Часть локально выбранных матчей снята из-за изменения глобальных фильтров.");
    }
  }, [existingMatchIds, selectedMatchIds]);

  useEffect(() => {
    if (openStartedAt == null || !selectedCell) return;
    const elapsed = performance.now() - openStartedAt;
    setOpenLatencyMs((prev) => [...prev.slice(-9), elapsed]);
    setOpenStartedAt(null);
  }, [selectedCell, openStartedAt]);

  const metricMinMax = useMemo(() => {
    const vals: number[] = [];
    for (const row of matrixRows) {
      for (const zone of ALL_PRICE_ZONES) {
        const cell = row.zones[zone];
        const occ = computeOccupancy(row.matchId, "A", zone, cell.issued, availability).zoneInMatch;
        const value = metricValue(metric, { sold: cell.sold, issued: cell.issued, revenue: cell.revenue, occupancy: occ });
        if (value != null) vals.push(value);
      }
    }
    const min = vals.length ? Math.min(...vals) : 0;
    const max = vals.length ? Math.max(...vals) : 0;
    return { min, max };
  }, [matrixRows, metric, availability]);

  const sortedRows = useMemo(() => {
    if (!sortByZone.zoneId || !sortByZone.direction) return matrixRows;
    return [...matrixRows].sort((a, b) => {
      const av = a.zones[sortByZone.zoneId!];
      const bv = b.zones[sortByZone.zoneId!];
      const ao = computeOccupancy(a.matchId, "A", sortByZone.zoneId!, av.issued, availability).zoneInMatch;
      const bo = computeOccupancy(b.matchId, "A", sortByZone.zoneId!, bv.issued, availability).zoneInMatch;
      const left = metricValue(metric, { sold: av.sold, issued: av.issued, revenue: av.revenue, occupancy: ao }) ?? -Infinity;
      const right = metricValue(metric, { sold: bv.sold, issued: bv.issued, revenue: bv.revenue, occupancy: bo }) ?? -Infinity;
      return sortByZone.direction === "desc" ? right - left : left - right;
    });
  }, [matrixRows, sortByZone, metric, availability]);

  const activeFilterCount =
    Number(selectedMatchIds.length > 0) +
    Number(selectedZoneIds.length > 0) +
    Number(selectedSectorIds.length > 0);

  const selectedMatch = selectedCell
    ? sortedRows.find((row) => row.matchId === selectedCell.matchId) ?? null
    : null;

  const matchOptions = sortedRows.map((row) => ({ value: row.matchId, label: `${row.matchLabel} · ${row.date.toLocaleDateString("ru-RU")}` }));
  const zoneOptions = ALL_PRICE_ZONES.map((zone) => ({ value: zone, label: PRICE_ZONE_LABELS[zone] }));
  const sectorOptions = ALL_SECTORS.map((sector) => ({ value: sector, label: sector }));

  return (
    <Card className="min-w-0">
      <CardHeader>
        <CardTitle>Продажи по ценовым зонам и секторам</CardTitle>
        <p className="text-sm text-[var(--muted)]">Сравнение заполняемости, продаж и выручки по матчам</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <MultiSelect label="Матчи" options={matchOptions} value={selectedMatchIds} onChange={(v) => setSelectedMatchIds(v)} emptyMeansAll searchable searchPlaceholder="Поиск матча..." selectAllLabel="Все матчи" allSelectedLabel="Все матчи" />
          <MultiSelect label="Ценовые зоны" options={zoneOptions} value={selectedZoneIds} onChange={(v) => setSelectedZoneIds(v as PriceZone[])} emptyMeansAll selectAllLabel="Все зоны" allSelectedLabel="Все зоны" />
          <MultiSelect label="Секторы" options={sectorOptions} value={selectedSectorIds} onChange={(v) => setSelectedSectorIds(v as Sector[])} emptyMeansAll searchable searchPlaceholder="Поиск сектора..." selectAllLabel="Все секторы" allSelectedLabel="Все секторы" />
          <Select label="Показатель" value={metric} onChange={(e) => setMetric(e.target.value as ZoneSectorMetric)}>
            {Object.entries(METRIC_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </Select>
          <Select label="Срез сравнения" value={slice} onChange={(e) => setSlice(e.target.value as ComparisonSlice)}>
            {SLICE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </Select>
          <button type="button" className="mt-auto h-9 rounded-md border border-[var(--border)] px-3 text-sm" onClick={() => {
            setSelectedMatchIds([]);
            setSelectedZoneIds([]);
            setSelectedSectorIds([]);
            setInvalidHint(null);
          }}>
            Сбросить фильтры
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="rounded-full bg-[var(--background)] px-2 py-1">{activeFilterCount} активн. фильтров</span>
          {selectedMatchIds.length > 0 && <span className="rounded-full border border-[var(--border)] px-2 py-1">Матчи: {selectedMatchIds.length}</span>}
          {selectedZoneIds.length > 0 && <span className="rounded-full border border-[var(--border)] px-2 py-1">Зоны: {selectedZoneIds.length}</span>}
          {selectedSectorIds.length > 0 && <span className="rounded-full border border-[var(--border)] px-2 py-1">Секторы: {selectedSectorIds.length}</span>}
        </div>
        {invalidHint && <p className="text-xs text-amber-700">{invalidHint}</p>}

        <div className="hidden md:block">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[780px] text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-3 py-2 text-left text-xs text-[var(--muted)]">Матч</th>
                  {ALL_PRICE_ZONES.map((zone) => (
                    <th key={zone} className="px-2 py-2 text-left text-xs text-[var(--muted)]">
                      <button
                        className="inline-flex min-h-11 items-center rounded px-1 hover:bg-[var(--background)]"
                        onClick={() => {
                          setSortByZone((prev) => {
                            if (prev.zoneId !== zone) return { zoneId: zone, direction: "desc" };
                            if (prev.direction === "desc") return { zoneId: zone, direction: "asc" };
                            return { zoneId: null, direction: null };
                          });
                        }}
                      >
                        {MATRIX_ZONE_HEADERS[zone]}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row) => (
                  <tr key={row.matchId} className="border-b border-[var(--border)]">
                    <td className="px-3 py-2.5">
                      <button className="min-h-11 text-left" onClick={() => {
                        setOpenStartedAt(performance.now());
                        setSelectedCell({ matchId: row.matchId, zoneId: ALL_PRICE_ZONES[0] });
                      }}>
                        <div className="font-medium">{row.matchLabel}</div>
                        <div className="text-xs text-[var(--muted)]">{row.date.toLocaleDateString("ru-RU")}</div>
                      </button>
                    </td>
                    {ALL_PRICE_ZONES.map((zone) => {
                      const cell = row.zones[zone];
                      const occ = computeOccupancy(row.matchId, "A", zone, cell.issued, availability).zoneInMatch;
                      const value = metricValue(metric, { sold: cell.sold, issued: cell.issued, revenue: cell.revenue, occupancy: occ });
                      const ratio =
                        value == null || metricMinMax.max <= metricMinMax.min
                          ? null
                          : (value - metricMinMax.min) / (metricMinMax.max - metricMinMax.min);
                      const selected = selectedCell?.matchId === row.matchId && selectedCell.zoneId === zone;
                      const tooltip = [
                        `Продано: ${formatNumber(cell.sold)}`,
                        `Выручка: ${formatCurrency(cell.revenue)}`,
                        `Заполняемость (зона в матче): ${formatMetric("occupancy", occ)}`,
                      ].join("\n");
                      return (
                        <td key={zone} className="px-2 py-2">
                          <button
                            className={clsx("min-h-11 w-full rounded border px-2 py-1 text-left", heatClass(ratio), selected && "ring-2 ring-[var(--accent)]")}
                            title={tooltip}
                            aria-label={`${row.matchLabel} ${MATRIX_ZONE_HEADERS[zone]} ${formatMetric(metric, value)}`}
                            onClick={() => {
                              setOpenStartedAt(performance.now());
                              setSelectedCell({ matchId: row.matchId, zoneId: zone });
                              setExpandedKeys((prev) => new Set(prev).add(`${row.matchId}|${zone}`));
                            }}
                          >
                            <div className="font-medium">{formatMetric(metric, value)}</div>
                            <div className="text-[10px] opacity-80">{formatNumber(cell.sold)} / {formatCurrency(cell.revenue)}</div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {sortedRows.map((row) => (
            <article key={row.matchId} className="rounded-lg border border-[var(--border)] p-3">
              <p className="font-medium">{row.matchLabel}</p>
              <p className="text-xs text-[var(--muted)]">{row.date.toLocaleDateString("ru-RU")}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {ALL_PRICE_ZONES.map((zone) => {
                  const cell = row.zones[zone];
                  const occ = computeOccupancy(row.matchId, "A", zone, cell.issued, availability).zoneInMatch;
                  const value = metricValue(metric, { sold: cell.sold, issued: cell.issued, revenue: cell.revenue, occupancy: occ });
                  return <div key={zone} className="rounded border border-[var(--border)] p-2 text-xs"><div>{MATRIX_ZONE_HEADERS[zone]}</div><div className="font-medium">{formatMetric(metric, value)}</div></div>;
                })}
              </div>
              <button
                className="mt-3 min-h-11 w-full rounded-md border border-[var(--border)]"
                onClick={() => {
                  setOpenStartedAt(performance.now());
                  setSelectedCell({ matchId: row.matchId, zoneId: ALL_PRICE_ZONES[0] });
                }}
              >
                Подробнее
              </button>
            </article>
          ))}
        </div>

        <div className="rounded-md border border-[var(--border)] p-2 text-xs">
          <div className="mb-1 font-medium">Легенда шкалы</div>
          <div className="h-2 w-full rounded bg-gradient-to-r from-blue-100 via-blue-300 to-blue-600" />
          <div className="mt-1 flex justify-between text-[10px] text-[var(--muted)]">
            <span>{formatMetric(metric, metricMinMax.min)}</span>
            <span>{formatMetric(metric, metricMinMax.max)}</span>
          </div>
        </div>

        {selectedMatch && selectedCell && (
          <section className="rounded-lg border border-[var(--border)] p-3" aria-live="polite">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-medium">{selectedMatch.matchLabel}</p>
                <p className="text-xs text-[var(--muted)]">{selectedMatch.date.toLocaleDateString("ru-RU")}</p>
              </div>
              <div className="flex gap-1">
                <button className={clsx("min-h-10 rounded border px-2 text-xs", mode === "zones_to_sectors" && "bg-[var(--background)]")} onClick={() => setMode("zones_to_sectors")}>По ценовым зонам</button>
                <button className={clsx("min-h-10 rounded border px-2 text-xs", mode === "sectors_to_zones" && "bg-[var(--background)]")} onClick={() => setMode("sectors_to_zones")}>По секторам</button>
              </div>
            </div>
            {mode === "zones_to_sectors" ? (
              <div className="space-y-2">
                {ALL_PRICE_ZONES.map((zone) => {
                  if (selectedZoneIds.length > 0 && !selectedZoneIds.includes(zone)) return null;
                  const sectors = inferChildSectorsForZone(selectedMatch.matchId, zone, allAgg);
                  if (sectors.length === 0) return null;
                  const parentKey = `${selectedMatch.matchId}|${zone}`;
                  const open = expandedKeys.has(parentKey);
                  return (
                    <div key={zone} className="rounded border border-[var(--border)]">
                      <button
                        className="flex min-h-11 w-full items-center justify-between px-3 text-left"
                        aria-expanded={open}
                        onClick={() => setExpandedKeys((prev) => {
                          const next = new Set(prev);
                          if (next.has(parentKey)) next.delete(parentKey); else next.add(parentKey);
                          return next;
                        })}
                      >
                        <span>{MATRIX_ZONE_HEADERS[zone]}</span>
                        <span>{open ? "−" : "+"}</span>
                      </button>
                      {open && (
                        <div className="border-t border-[var(--border)] px-3 py-2">
                          {sectors.sort((a, b) => a.localeCompare(b, "ru")).map((sector) => {
                            const agg = allAgg.get(`${selectedMatch.matchId}|${sector}|${zone}`);
                            if (!agg) return null;
                            const occ = computeOccupancy(selectedMatch.matchId, sector, zone, agg.issued, availability);
                            return <div key={`${zone}-${sector}`} className="flex items-center justify-between py-1 text-sm"><span>{sector}</span><span>{formatMetric(metric, metricValue(metric, { sold: agg.sold, issued: agg.issued, revenue: agg.revenue, occupancy: occ.zoneInSector }))}</span></div>;
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {ALL_SECTORS.map((sector) => {
                  if (selectedSectorIds.length > 0 && !selectedSectorIds.includes(sector)) return null;
                  const zones = inferChildZonesForSector(selectedMatch.matchId, sector, allAgg);
                  if (zones.length === 0) return null;
                  const parentKey = `${selectedMatch.matchId}|${sector}`;
                  const open = expandedKeys.has(parentKey);
                  return (
                    <div key={sector} className="rounded border border-[var(--border)]">
                      <button className="flex min-h-11 w-full items-center justify-between px-3 text-left" aria-expanded={open} onClick={() => setExpandedKeys((prev) => {
                        const next = new Set(prev);
                        if (next.has(parentKey)) next.delete(parentKey); else next.add(parentKey);
                        return next;
                      })}>
                        <span>{sector}</span><span>{open ? "−" : "+"}</span>
                      </button>
                      {open && <div className="border-t border-[var(--border)] px-3 py-2">{zones.map((zone) => {
                        const agg = allAgg.get(`${selectedMatch.matchId}|${sector}|${zone}`);
                        if (!agg) return null;
                        const occ = computeOccupancy(selectedMatch.matchId, sector, zone, agg.issued, availability);
                        return <div key={`${sector}-${zone}`} className="flex items-center justify-between py-1 text-sm"><span>{MATRIX_ZONE_HEADERS[zone]}</span><span>{formatMetric(metric, metricValue(metric, { sold: agg.sold, issued: agg.issued, revenue: agg.revenue, occupancy: occ.zoneInSector }))}</span></div>;
                      })}</div>}
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {slice === "final" && (
          <p className="text-xs text-[var(--muted)]">
            Незаполненные/незавершенные матчи исключены из итогового среза без прогноза.
          </p>
        )}
        {openLatencyMs.length > 0 && (
          <p className="text-xs text-[var(--muted)]">
            Latency открытия детализации: последний {openLatencyMs[openLatencyMs.length - 1]!.toFixed(1)} ms, средний {(openLatencyMs.reduce((sum, v) => sum + v, 0) / openLatencyMs.length).toFixed(1)} ms.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
