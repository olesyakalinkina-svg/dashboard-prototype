import { differenceInCalendarDays, endOfDay, isAfter } from "date-fns";
import { ALL_PRICE_ZONES, ALL_SECTORS } from "@/lib/ticket-filter-options";
import { getTicketFreeQuantity, getTicketIssuedQuantity } from "@/lib/ticket-sales-metrics";
import type { Match, PriceZone, Sector, Transaction } from "@/types/dashboard";

export type ZoneSectorMetric = "occupancy" | "sold" | "revenue" | "avgPrice";
export type ComparisonSlice =
  | "current"
  | "days_before_1"
  | "days_before_3"
  | "days_before_7"
  | "days_before_14"
  | "days_before_30"
  | "final";
export type DetailMode = "zones_to_sectors" | "sectors_to_zones";

type Aggregate = {
  revenue: number;
  sold: number;
  free: number;
  issued: number;
};

export type ZoneSectorCell = Aggregate & {
  matchId: string;
  sectorId: Sector;
  priceZoneId: PriceZone;
  avgPrice: number | null;
};

export type MatrixRow = {
  matchId: string;
  matchLabel: string;
  date: Date;
  zones: Record<PriceZone, ZoneSectorCell>;
  totals: Aggregate & { avgPrice: number | null };
  excludedFromFinalSlice: boolean;
};

export type AvailabilityIndex = {
  zoneInMatch: Map<string, number>;
  sectorInMatch: Map<string, number>;
  zoneInSector: Map<string, number>;
};

export type OccupancyValues = {
  zoneInMatch: number | null;
  sectorInMatch: number | null;
  zoneInSector: number | null;
};

type BuildOptions = {
  transactions: Transaction[];
  matchesById: Map<string, Match>;
  localMatchIds: string[];
  localPriceZones: PriceZone[];
  localSectors: Sector[];
  slice: ComparisonSlice;
};

type KeyedAgg = Map<string, Aggregate>;

function createAggregate(): Aggregate {
  return { revenue: 0, sold: 0, free: 0, issued: 0 };
}

function ticketStableKey(tx: Transaction): string {
  return tx.id;
}

function includeBySlice(tx: Transaction, matchDate: Date, slice: ComparisonSlice): boolean {
  if (slice === "current") return true;
  if (slice === "final") return !isAfter(tx.date, endOfDay(matchDate));
  const day = Number(slice.replace("days_before_", ""));
  const daysBefore = differenceInCalendarDays(matchDate, tx.date);
  return daysBefore >= day;
}

export function preAggregateZoneSector(
  transactions: Transaction[],
  matchesById: Map<string, Match>,
  slice: ComparisonSlice,
): KeyedAgg {
  const out: KeyedAgg = new Map();
  const dedupe = new Set<string>();
  for (const tx of transactions) {
    if (tx.stream !== "tickets" || tx.ticketType !== "arena") continue;
    if (!tx.matchId || !tx.sector || !tx.priceZone) continue;
    const match = matchesById.get(tx.matchId);
    if (!match) continue;
    if (!includeBySlice(tx, match.date, slice)) continue;
    const dedupeKey = ticketStableKey(tx);
    if (dedupe.has(dedupeKey)) continue;
    dedupe.add(dedupeKey);
    const key = `${tx.matchId}|${tx.sector}|${tx.priceZone}`;
    const agg = out.get(key) ?? createAggregate();
    agg.revenue += tx.amount;
    if (tx.amount > 0) agg.sold += tx.quantity;
    agg.free += getTicketFreeQuantity(tx);
    agg.issued += getTicketIssuedQuantity(tx);
    out.set(key, agg);
  }
  return out;
}

function aggregateValue(agg: Aggregate): number | null {
  return agg.sold > 0 ? agg.revenue / agg.sold : null;
}

export function buildAvailabilityIndex(base: KeyedAgg): AvailabilityIndex {
  const zoneInMatch = new Map<string, number>();
  const sectorInMatch = new Map<string, number>();
  const zoneInSector = new Map<string, number>();
  for (const [key, agg] of base) {
    const [matchId, sectorId, zoneId] = key.split("|");
    const zm = `${matchId}|${zoneId}`;
    const sm = `${matchId}|${sectorId}`;
    zoneInMatch.set(zm, (zoneInMatch.get(zm) ?? 0) + agg.issued);
    sectorInMatch.set(sm, (sectorInMatch.get(sm) ?? 0) + agg.issued);
    zoneInSector.set(key, agg.issued);
  }
  return { zoneInMatch, sectorInMatch, zoneInSector };
}

export function computeOccupancy(
  matchId: string,
  sectorId: Sector,
  zoneId: PriceZone,
  issued: number,
  availability: AvailabilityIndex,
): OccupancyValues {
  const zoneDen = availability.zoneInMatch.get(`${matchId}|${zoneId}`) ?? 0;
  const sectorDen = availability.sectorInMatch.get(`${matchId}|${sectorId}`) ?? 0;
  const pairDen = availability.zoneInSector.get(`${matchId}|${sectorId}|${zoneId}`) ?? 0;
  return {
    zoneInMatch: zoneDen > 0 ? (issued / zoneDen) * 100 : null,
    sectorInMatch: sectorDen > 0 ? (issued / sectorDen) * 100 : null,
    zoneInSector: pairDen > 0 ? (issued / pairDen) * 100 : null,
  };
}

export function buildMatrixRows(options: BuildOptions): MatrixRow[] {
  const matchFilterSet = options.localMatchIds.length
    ? new Set(options.localMatchIds)
    : null;
  const zoneFilterSet = options.localPriceZones.length
    ? new Set(options.localPriceZones)
    : null;
  const sectorFilterSet = options.localSectors.length
    ? new Set(options.localSectors)
    : null;

  const sliceAgg = preAggregateZoneSector(
    options.transactions,
    options.matchesById,
    options.slice,
  );

  const rows = new Map<string, MatrixRow>();

  for (const [key, agg] of sliceAgg) {
    const [matchId, sectorId, zoneId] = key.split("|") as [string, Sector, PriceZone];
    if (matchFilterSet && !matchFilterSet.has(matchId)) continue;
    if (zoneFilterSet && !zoneFilterSet.has(zoneId)) continue;
    if (sectorFilterSet && !sectorFilterSet.has(sectorId)) continue;
    const match = options.matchesById.get(matchId);
    if (!match) continue;
    let row = rows.get(matchId);
    if (!row) {
      const zones = {} as Record<PriceZone, ZoneSectorCell>;
      for (const zone of ALL_PRICE_ZONES) {
        zones[zone] = {
          matchId,
          sectorId: "A",
          priceZoneId: zone,
          revenue: 0,
          sold: 0,
          free: 0,
          issued: 0,
          avgPrice: null,
        };
      }
      row = {
        matchId,
        matchLabel: `vs ${match.opponent}`,
        date: match.date,
        zones,
        totals: { revenue: 0, sold: 0, free: 0, issued: 0, avgPrice: null },
        excludedFromFinalSlice: options.slice === "final" && !match.eventCompleted,
      };
      rows.set(matchId, row);
    }
    row.totals.revenue += agg.revenue;
    row.totals.sold += agg.sold;
    row.totals.free += agg.free;
    row.totals.issued += agg.issued;
    const zoneCell = row.zones[zoneId];
    zoneCell.revenue += agg.revenue;
    zoneCell.sold += agg.sold;
    zoneCell.free += agg.free;
    zoneCell.issued += agg.issued;
    zoneCell.avgPrice = aggregateValue(zoneCell);
    row.totals.avgPrice = aggregateValue(row.totals);
  }

  return Array.from(rows.values()).sort((a, b) => b.date.getTime() - a.date.getTime());
}

export function inferChildZonesForSector(
  matchId: string,
  sectorId: Sector,
  agg: KeyedAgg,
): PriceZone[] {
  const result: PriceZone[] = [];
  for (const zone of ALL_PRICE_ZONES) {
    if (agg.has(`${matchId}|${sectorId}|${zone}`)) result.push(zone);
  }
  return result;
}

export function inferChildSectorsForZone(
  matchId: string,
  zoneId: PriceZone,
  agg: KeyedAgg,
): Sector[] {
  const result: Sector[] = [];
  for (const sector of ALL_SECTORS) {
    if (agg.has(`${matchId}|${sector}|${zoneId}`)) result.push(sector);
  }
  return result;
}
