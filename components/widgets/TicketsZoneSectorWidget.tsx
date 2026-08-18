"use client";

import clsx from "clsx";
import { ChevronDown, ChevronUp, Settings2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/Card";
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

const METRIC_OPTIONS: ZoneSectorMetric[] = ["occupancy", "revenue"];

const DESKTOP_PAGE_SIZE = 8;
const MOBILE_PAGE_SIZE = 4;

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

function isAllowedMetric(metric: ZoneSectorMetric): boolean {
  return METRIC_OPTIONS.includes(metric);
}

function heatClass(ratio: number | null): string {
  if (ratio == null) return "bg-slate-50";
  if (ratio >= 0.85) return "bg-blue-300";
  if (ratio >= 0.65) return "bg-blue-200";
  if (ratio >= 0.45) return "bg-blue-100";
  if (ratio >= 0.25) return "bg-sky-50";
  return "bg-slate-50";
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
  const [showMoreSettings, setShowMoreSettings] = useState(false);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [desktopPage, setDesktopPage] = useState(0);
  const [mobilePage, setMobilePage] = useState(0);
  const [activeTooltip, setActiveTooltip] = useState<{
    key: string;
    x: number;
    y: number;
    text: string;
  } | null>(null);
  const settingsRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    setDesktopPage(0);
    setMobilePage(0);
  }, [selectedMatchIds, selectedZoneIds, selectedSectorIds, slice, metric]);

  useEffect(() => {
    function onOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowMoreSettings(false);
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  useEffect(() => {
    if (!isAllowedMetric(metric)) {
      setMetric("occupancy");
    }
  }, [metric]);

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
    return { min, max, count: vals.length };
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

  const desktopPageCount = Math.max(1, Math.ceil(sortedRows.length / DESKTOP_PAGE_SIZE));
  const mobilePageCount = Math.max(1, Math.ceil(sortedRows.length / MOBILE_PAGE_SIZE));
  const desktopRows = sortedRows.slice(desktopPage * DESKTOP_PAGE_SIZE, desktopPage * DESKTOP_PAGE_SIZE + DESKTOP_PAGE_SIZE);
  const mobileRows = sortedRows.slice(mobilePage * MOBILE_PAGE_SIZE, mobilePage * MOBILE_PAGE_SIZE + MOBILE_PAGE_SIZE);

  const matchOptions = sortedRows.map((row) => ({ value: row.matchId, label: `${row.matchLabel} · ${row.date.toLocaleDateString("ru-RU")}` }));
  const zoneOptions = ALL_PRICE_ZONES.map((zone) => ({ value: zone, label: PRICE_ZONE_LABELS[zone] }));
  const sectorOptions = ALL_SECTORS.map((sector) => ({ value: sector, label: sector }));

  return (
    <Card className="min-w-0">
      <CardHeader className="pb-2">
        <div className="min-w-0 space-y-1">
          <h3 className="text-[18px] font-semibold leading-tight text-[var(--foreground)]">Продажи по ценовым зонам и секторам</h3>
          <p className="text-[13px] leading-5 text-[var(--muted)]">Сравнение заполняемости, продаж и выручки по матчам</p>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="md:hidden">
          <button type="button" className="h-10 rounded-md border border-[var(--border)] px-3 text-sm" onClick={() => setShowMobileFilters((v) => !v)}>Фильтры</button>
        </div>

        <div className={clsx("hidden md:block", showMobileFilters && "block")}>
          <div className="flex flex-wrap items-end gap-2">
            <MultiSelect label="Матчи" options={matchOptions} value={selectedMatchIds} onChange={(v) => setSelectedMatchIds(v)} emptyMeansAll searchable searchPlaceholder="Поиск матча..." selectAllLabel="Все матчи" allSelectedLabel="Все матчи" />
            <MultiSelect label="Ценовые зоны" options={zoneOptions} value={selectedZoneIds} onChange={(v) => setSelectedZoneIds(v as PriceZone[])} emptyMeansAll selectAllLabel="Все зоны" allSelectedLabel="Все зоны" />
            <MultiSelect label="Секторы" options={sectorOptions} value={selectedSectorIds} onChange={(v) => setSelectedSectorIds(v as Sector[])} emptyMeansAll searchable searchPlaceholder="Поиск сектора..." selectAllLabel="Все секторы" allSelectedLabel="Все секторы" />
            <Select
              label="Показатель"
              value={isAllowedMetric(metric) ? metric : "occupancy"}
              onChange={(e) => {
                const nextMetric = e.target.value as ZoneSectorMetric;
                setMetric(isAllowedMetric(nextMetric) ? nextMetric : "occupancy");
              }}
              className="h-10 text-sm"
            >
              {METRIC_OPTIONS.map((value) => (
                <option key={value} value={value}>{METRIC_LABELS[value]}</option>
              ))}
            </Select>
            <div ref={settingsRef} className="relative">
              <button type="button" className="h-10 rounded-md border border-[var(--border)] px-3 text-sm" onClick={() => setShowMoreSettings((v) => !v)}>
                <span className="inline-flex items-center gap-2"><Settings2 className="h-4 w-4" />Дополнительные настройки</span>
              </button>
              {showMoreSettings && (
                <div className="absolute right-0 top-11 z-30 w-72 rounded-md border border-[var(--border)] bg-white p-3 shadow-lg">
                  <Select label="Срез сравнения" value={slice} onChange={(e) => setSlice(e.target.value as ComparisonSlice)} className="w-full">
                    {SLICE_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </Select>
                </div>
              )}
            </div>
            {activeFilterCount > 0 && (
              <button type="button" className="h-10 rounded-md border border-[var(--border)] px-3 text-sm" onClick={() => {
                setSelectedMatchIds([]);
                setSelectedZoneIds([]);
                setSelectedSectorIds([]);
                setInvalidHint(null);
              }}>
                Сбросить фильтры
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {activeFilterCount > 0 && <span className="rounded-full border border-[var(--border)] px-2 py-1">Фильтры · {activeFilterCount}</span>}
          {selectedMatchIds.length > 0 && <span className="rounded-full border border-[var(--border)] px-2 py-1">Матчи: {selectedMatchIds.length}</span>}
          {selectedZoneIds.length > 0 && <span className="rounded-full border border-[var(--border)] px-2 py-1">Зоны: {selectedZoneIds.length}</span>}
          {selectedSectorIds.length > 0 && <span className="rounded-full border border-[var(--border)] px-2 py-1">Секторы: {selectedSectorIds.length}</span>}
        </div>
        {invalidHint && <p className="text-xs text-amber-700">{invalidHint}</p>}

        <div className="grid gap-4 xl:grid-cols-[minmax(0,70%)_minmax(260px,30%)] xl:items-start">
          <div className="min-w-0">
            <div className="hidden md:block">
              <div className="overflow-auto rounded-md border border-[var(--border)] xl:max-h-[590px]">
                <table className="w-full min-w-[760px] table-fixed text-sm">
                  <thead>
                    <tr className="sticky top-0 z-20 border-b border-[var(--border)] bg-white">
                      <th className="sticky left-0 z-30 w-[190px] bg-white px-3 py-3 text-left text-xs text-[var(--muted)]">Матч</th>
                      {ALL_PRICE_ZONES.map((zone) => (
                        <th key={zone} className="px-2 py-3 text-left text-xs text-[var(--muted)]">
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
                            <span className="inline-flex items-center">
                              {MATRIX_ZONE_HEADERS[zone]}
                              {sortByZone.zoneId === zone && sortByZone.direction === "desc" && <ChevronDown className="ml-1 h-3 w-3" />}
                              {sortByZone.zoneId === zone && sortByZone.direction === "asc" && <ChevronUp className="ml-1 h-3 w-3" />}
                            </span>
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {desktopRows.map((row, rowIndex) => (
                      <tr key={row.matchId} className="h-14 border-b border-[var(--border)]">
                        <td className="sticky left-0 z-10 bg-white px-3 py-2.5">
                          <button className="min-h-11 text-left" onClick={() => {
                            setOpenStartedAt(performance.now());
                            setSelectedCell({ matchId: row.matchId, zoneId: ALL_PRICE_ZONES[0] });
                          }}>
                            <div className="font-medium">{row.matchLabel}</div>
                            <div className="text-xs text-[var(--muted)]">{row.date.toLocaleDateString("ru-RU")}</div>
                          </button>
                        </td>
                        {ALL_PRICE_ZONES.map((zone, zoneIndex) => {
                          const cell = row.zones[zone];
                          const occ = computeOccupancy(row.matchId, "A", zone, cell.issued, availability).zoneInMatch;
                          const value = metricValue(metric, { sold: cell.sold, issued: cell.issued, revenue: cell.revenue, occupancy: occ });
                          const ratio =
                            value == null || metricMinMax.max <= metricMinMax.min
                              ? null
                              : (value - metricMinMax.min) / (metricMinMax.max - metricMinMax.min);
                          const selected = selectedCell?.matchId === row.matchId && selectedCell.zoneId === zone;
                          const tooltip = [
                            `${MATRIX_ZONE_HEADERS[zone]}`,
                            `Продано: ${formatNumber(cell.sold)}`,
                            `Выручка: ${formatCurrency(cell.revenue)}`,
                            `Оформлено: ${formatNumber(cell.issued)}`,
                            `Заполняемость (зона в матче): ${formatMetric("occupancy", occ)}`,
                            occ == null ? "Нет данных по вместимости" : "",
                          ].filter(Boolean).join("\n");
                          return (
                            <td key={zone} className="px-2 py-2">
                              <button
                                className={clsx("min-h-11 w-full rounded border border-[var(--border)] px-2 py-1 text-left", heatClass(ratio), selected && "ring-2 ring-blue-500")}
                                aria-label={`${row.matchLabel} ${MATRIX_ZONE_HEADERS[zone]} ${formatMetric(metric, value)}`}
                                onMouseEnter={(event) => {
                                  setActiveTooltip({
                                    key: `${row.matchId}-${zone}`,
                                    x: Math.max(8, Math.min(event.clientX + 12, window.innerWidth - 280)),
                                    y: Math.max(8, Math.min(event.clientY + 12, window.innerHeight - 150)),
                                    text: tooltip,
                                  });
                                }}
                                onMouseLeave={() => setActiveTooltip((prev) => (prev?.key === `${row.matchId}-${zone}` ? null : prev))}
                                onClick={(event) => {
                                  setOpenStartedAt(performance.now());
                                  setSelectedCell({ matchId: row.matchId, zoneId: zone });
                                  setExpandedKeys((prev) => new Set(prev).add(`${row.matchId}|${zone}`));
                                  setActiveTooltip({
                                    key: `${row.matchId}-${zone}-${rowIndex}-${zoneIndex}`,
                                    x: Math.max(8, Math.min(event.clientX + 12, window.innerWidth - 280)),
                                    y: Math.max(8, Math.min(event.clientY + 12, window.innerHeight - 150)),
                                    text: tooltip,
                                  });
                                }}
                              >
                                <div className="text-[15px] font-semibold leading-5">{formatMetric(metric, value)}</div>
                                {metric !== "occupancy" && <div className="text-xs text-[var(--muted)]">Заполняемость: {formatMetric("occupancy", occ)}</div>}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-2 flex items-center justify-between text-xs text-[var(--muted)]">
                <span>Показано матчей: {desktopRows.length} из {sortedRows.length}</span>
                <div className="flex items-center gap-2">
                  <button type="button" disabled={desktopPage === 0} onClick={() => setDesktopPage((v) => Math.max(0, v - 1))} className="h-8 rounded border border-[var(--border)] px-2 disabled:opacity-40">Назад</button>
                  <span>{desktopPage + 1} / {desktopPageCount}</span>
                  <button type="button" disabled={desktopPage >= desktopPageCount - 1} onClick={() => setDesktopPage((v) => Math.min(desktopPageCount - 1, v + 1))} className="h-8 rounded border border-[var(--border)] px-2 disabled:opacity-40">Вперёд</button>
                </div>
              </div>
            </div>

            <div className="space-y-3 md:hidden">
              {mobileRows.map((row) => (
                <article key={row.matchId} className="rounded-lg border border-[var(--border)] p-3">
                  <p className="font-medium">{row.matchLabel}</p>
                  <p className="text-xs text-[var(--muted)]">{row.date.toLocaleDateString("ru-RU")}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {ALL_PRICE_ZONES.map((zone) => {
                      const cell = row.zones[zone];
                      const occ = computeOccupancy(row.matchId, "A", zone, cell.issued, availability).zoneInMatch;
                      const value = metricValue(metric, { sold: cell.sold, issued: cell.issued, revenue: cell.revenue, occupancy: occ });
                      return (
                        <button key={zone} className="rounded border border-[var(--border)] p-2 text-left text-xs" onClick={() => {
                          setOpenStartedAt(performance.now());
                          setSelectedCell({ matchId: row.matchId, zoneId: zone });
                        }}>
                          <div className="text-[11px] text-[var(--muted)]">{MATRIX_ZONE_HEADERS[zone]}</div>
                          <div className="text-[15px] font-semibold">{formatMetric(metric, value)}</div>
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}
              <div className="flex items-center justify-between text-xs text-[var(--muted)]">
                <button type="button" disabled={mobilePage === 0} onClick={() => setMobilePage((v) => Math.max(0, v - 1))} className="h-8 rounded border border-[var(--border)] px-2 disabled:opacity-40">Назад</button>
                <span>{mobilePage + 1} / {mobilePageCount}</span>
                <button type="button" disabled={mobilePage >= mobilePageCount - 1} onClick={() => setMobilePage((v) => Math.min(mobilePageCount - 1, v + 1))} className="h-8 rounded border border-[var(--border)] px-2 disabled:opacity-40">Вперёд</button>
              </div>
            </div>
          </div>

          <section className="rounded-lg border border-[var(--border)] p-3 xl:max-h-[640px] xl:overflow-auto" aria-live="polite">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                {selectedMatch ? (
                  <>
                    <p className="font-medium">{selectedMatch.matchLabel}</p>
                    <p className="text-xs text-[var(--muted)]">{selectedMatch.date.toLocaleDateString("ru-RU")}</p>
                  </>
                ) : (
                  <>
                    <p className="font-medium">Выберите матч или ячейку</p>
                    <p className="text-xs text-[var(--muted)]">Детализация появится в этой панели справа.</p>
                  </>
                )}
              </div>
              {selectedCell && (
                <button type="button" className="inline-flex h-9 items-center gap-1 rounded-md border border-[var(--border)] px-2 text-xs" onClick={() => setSelectedCell(null)}>
                  <X className="h-3.5 w-3.5" /> Очистить
                </button>
              )}
            </div>

            {selectedMatch && selectedCell ? (
              <>
                <div className="mb-2 inline-flex rounded-md border border-[var(--border)] p-0.5">
                  <button className={clsx("h-9 rounded px-2 text-xs", mode === "zones_to_sectors" && "bg-[var(--background)]")} onClick={() => setMode("zones_to_sectors")}>По ценовым зонам</button>
                  <button className={clsx("h-9 rounded px-2 text-xs", mode === "sectors_to_zones" && "bg-[var(--background)]")} onClick={() => setMode("sectors_to_zones")}>По секторам</button>
                </div>
                {mode === "zones_to_sectors" ? (
                  <div className="space-y-2">
                    {ALL_PRICE_ZONES.map((zone) => {
                      if (selectedZoneIds.length > 0 && !selectedZoneIds.includes(zone)) return null;
                      const sectors = inferChildSectorsForZone(selectedMatch.matchId, zone, allAgg);
                      if (sectors.length === 0) return null;
                      const parentKey = `${selectedMatch.matchId}|${zone}`;
                      const open = expandedKeys.has(parentKey);
                      const parentCell = selectedMatch.zones[zone];
                      const parentOcc = computeOccupancy(selectedMatch.matchId, "A", zone, parentCell.issued, availability).zoneInMatch;
                      return (
                        <div key={zone} className="rounded border border-[var(--border)]">
                          <button className="flex min-h-11 w-full items-center justify-between px-3 text-left" aria-expanded={open} onClick={() => {
                            setExpandedKeys((prev) => {
                              const next = new Set(prev);
                              if (next.has(parentKey)) next.delete(parentKey); else next.add(parentKey);
                              return next;
                            });
                          }}>
                            <span className="font-medium">{MATRIX_ZONE_HEADERS[zone]}</span>
                            <span className="text-xs">{formatMetric("occupancy", parentOcc)} · {formatNumber(parentCell.sold)} шт</span>
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
                      const soldSum = zones.reduce((sum, zone) => sum + (allAgg.get(`${selectedMatch.matchId}|${sector}|${zone}`)?.sold ?? 0), 0);
                      const issuedSum = zones.reduce((sum, zone) => sum + (allAgg.get(`${selectedMatch.matchId}|${sector}|${zone}`)?.issued ?? 0), 0);
                      const parentOcc = computeOccupancy(selectedMatch.matchId, sector, zones[0]!, issuedSum, availability).sectorInMatch;
                      return (
                        <div key={sector} className="rounded border border-[var(--border)]">
                          <button className="flex min-h-11 w-full items-center justify-between px-3 text-left" aria-expanded={open} onClick={() => {
                            setExpandedKeys((prev) => {
                              const next = new Set(prev);
                              if (next.has(parentKey)) next.delete(parentKey); else next.add(parentKey);
                              return next;
                            });
                          }}>
                            <span className="font-medium">{sector}</span>
                            <span className="text-xs">{formatMetric("occupancy", parentOcc)} · {formatNumber(soldSum)} шт</span>
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
              </>
            ) : (
              <div className="rounded-md bg-[var(--background)] p-3 text-xs text-[var(--muted)]">
                Выберите ячейку матрицы, чтобы увидеть детализацию по зоне/сектору.
              </div>
            )}
          </section>
        </div>

        <div className="rounded-md border border-[var(--border)] p-2 text-xs">
          <div className="mb-1 font-medium">Легенда шкалы</div>
          {metricMinMax.count === 0 ? (
            <div className="rounded bg-slate-100 px-2 py-1 text-[11px] text-[var(--muted)]">Нет данных для построения шкалы</div>
          ) : metricMinMax.max === metricMinMax.min ? (
            <div className="rounded bg-slate-100 px-2 py-1 text-[11px] text-[var(--muted)]">Все значения одинаковы</div>
          ) : (
            <>
              <div className="h-2 w-full rounded bg-gradient-to-r from-slate-50 via-blue-100 to-blue-300" />
              <div className="mt-1 flex justify-between text-[11px] text-[var(--muted)]">
                <span>{formatMetric(metric, metricMinMax.min)}</span>
                <span>{formatMetric(metric, metricMinMax.max)}</span>
              </div>
            </>
          )}
        </div>

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

        {activeTooltip && (
          <div className="pointer-events-none fixed z-40 max-w-xs whitespace-pre-line rounded-md border border-[var(--border)] bg-white p-2 text-[13px] shadow-lg" style={{ left: activeTooltip.x, top: activeTooltip.y }}>
            {activeTooltip.text}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
