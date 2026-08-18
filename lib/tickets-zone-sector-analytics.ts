import { endOfDay, format, isAfter } from "date-fns";
import { ru } from "date-fns/locale";
import {
  getSectorCapacitiesForMatch,
  splitSectorCapacityForDemand,
} from "@/lib/arena-sector-inventory";
import {
  ALL_PRICE_ZONES,
  ALL_SECTORS,
  PRICE_ZONE_LABELS,
  allowedPriceZonesForSector,
  allowedSectorsForPriceZone,
  hasAllowedFilterIntersection,
  isAllowedSectorPriceZone,
  visiblePriceZonesForFilters,
  visibleSectorsForFilters,
} from "@/lib/ticket-filter-options";
import { getTicketFreeQuantity, getTicketIssuedQuantity } from "@/lib/ticket-sales-metrics";
import type { Match, PriceZone, Sector, Transaction } from "@/types/dashboard";

export {
  allowedPriceZonesForSector,
  allowedSectorsForPriceZone,
  hasAllowedFilterIntersection,
  isAllowedSectorPriceZone,
  visiblePriceZonesForFilters,
  visibleSectorsForFilters,
};

export type ZoneSectorMetric = "occupancy" | "sold" | "revenue" | "avgPrice";
export type AutoSalesSlice = "current" | "final";
export type DetailMode = "zones_to_sectors" | "sectors_to_zones";

export type Aggregate = {
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
};

export type AvailabilityIndex = {
  /** Sum of combo masses for this zone across sectors that allow it. */
  zoneInMatch: Map<string, number>;
  /** Sector capacity (not issued). */
  sectorInMatch: Map<string, number>;
  /** Available ticket mass at match × sector × zone. Covers issued when possible. */
  zoneInSector: Map<string, number>;
  /** match.capacity − sum(combo masses). 0 when the venue map covers the bowl. */
  leftoverByMatch: Map<string, number>;
};

export type OccupancyValues = {
  zoneInMatch: number | null;
  sectorInMatch: number | null;
  zoneInSector: number | null;
};

export type InvalidSectorPriceZoneRecord = {
  id: string;
  matchId: string;
  sector: Sector;
  priceZone: PriceZone;
};

export type AllowedCellKind = "values" | "zeros" | "dash";

export type AllowedCellDisplay = {
  revenue: number | null;
  sold: number | null;
  free: number | null;
  issued: number | null;
  avgPrice: number | null;
  occupancy: number | null;
  kind: AllowedCellKind;
};

type BuildOptions = {
  transactions: Transaction[];
  matchesById: Map<string, Match>;
  localMatchIds: string[];
  localPriceZones: PriceZone[];
  localSectors: Sector[];
};

export type ZoneSectorTreeContext = {
  agg: KeyedAgg;
  availability: AvailabilityIndex;
  matchesById: Map<string, Match>;
  localMatchIds: string[];
  localPriceZones: PriceZone[];
  localSectors: Sector[];
};

export type ZoneSectorTreeLevel = "match" | "section" | "leaf";

export type ZoneSectorTreeNode = {
  id: string;
  level: ZoneSectorTreeLevel;
  matchId: string;
  date: Date | null;
  label: string;
  zoneId?: PriceZone;
  sectorId?: Sector;
  kind: AllowedCellKind;
  revenue: number | null;
  sold: number | null;
  free: number | null;
  issued: number | null;
  avgPrice: number | null;
  occupancy: number | null;
  hasChildren: boolean;
  children: ZoneSectorTreeNode[];
};

export type ZoneSectorFlatRow = Omit<ZoneSectorTreeNode, "children"> & {
  depth: number;
};

export type KeyedAgg = Map<string, Aggregate>;

function createAggregate(): Aggregate {
  return { revenue: 0, sold: 0, free: 0, issued: 0 };
}

function addAggregate(target: Aggregate, source: Aggregate): void {
  target.revenue += source.revenue;
  target.sold += source.sold;
  target.free += source.free;
  target.issued += source.issued;
}

function ticketStableKey(tx: Transaction): string {
  return tx.id;
}

function includeBySlice(tx: Transaction, matchDate: Date, slice: AutoSalesSlice): boolean {
  if (slice === "current") return true;
  return !isAfter(tx.date, endOfDay(matchDate));
}

/**
 * Sales slice is automatic: completed matches use final sales (through
 * match day); future or unfinished matches use the current snapshot.
 * Unfinished matches are not forecasted.
 */
export function effectiveSliceForMatch(match: Match): AutoSalesSlice {
  return match.eventCompleted ? "final" : "current";
}

export function comboKey(matchId: string, sectorId: Sector, zoneId: PriceZone): string {
  return `${matchId}|${sectorId}|${zoneId}`;
}

export function collectInvalidSectorPriceZoneRecords(
  transactions: Transaction[],
): InvalidSectorPriceZoneRecord[] {
  const invalid: InvalidSectorPriceZoneRecord[] = [];
  for (const tx of transactions) {
    if (tx.stream !== "tickets" || tx.ticketType !== "arena") continue;
    if (!tx.matchId || !tx.sector || !tx.priceZone) continue;
    if (isAllowedSectorPriceZone(tx.sector, tx.priceZone)) continue;
    invalid.push({
      id: tx.id,
      matchId: tx.matchId,
      sector: tx.sector,
      priceZone: tx.priceZone,
    });
  }
  return invalid;
}

function warnInvalidSectorPriceZoneRecords(
  records: InvalidSectorPriceZoneRecord[],
  total = records.length,
): void {
  if (process.env.NODE_ENV === "production" || total === 0) return;
  console.warn(
    `[tickets-zone-sector] ${total} invalid sector×priceZone records excluded from metrics`,
    records.slice(0, 50),
  );
}

export function preAggregateZoneSector(
  transactions: Transaction[],
  matchesById: Map<string, Match>,
): KeyedAgg {
  const out: KeyedAgg = new Map();
  const dedupe = new Set<string>();
  const invalidSample: InvalidSectorPriceZoneRecord[] = [];
  let invalidCount = 0;

  for (const tx of transactions) {
    if (tx.stream !== "tickets" || tx.ticketType !== "arena") continue;
    if (!tx.matchId || !tx.sector || !tx.priceZone) continue;
    if (!isAllowedSectorPriceZone(tx.sector, tx.priceZone)) {
      invalidCount += 1;
      if (invalidSample.length < 50) {
        invalidSample.push({
          id: tx.id,
          matchId: tx.matchId,
          sector: tx.sector,
          priceZone: tx.priceZone,
        });
      }
      continue;
    }
    const match = matchesById.get(tx.matchId);
    if (!match) continue;
    if (!includeBySlice(tx, match.date, effectiveSliceForMatch(match))) continue;
    const dedupeKey = ticketStableKey(tx);
    if (dedupe.has(dedupeKey)) continue;
    dedupe.add(dedupeKey);
    const key = comboKey(tx.matchId, tx.sector, tx.priceZone);
    const agg = out.get(key) ?? createAggregate();
    agg.revenue += tx.amount;
    if (tx.amount > 0) agg.sold += tx.quantity;
    agg.free += getTicketFreeQuantity(tx);
    agg.issued += getTicketIssuedQuantity(tx);
    out.set(key, agg);
  }
  warnInvalidSectorPriceZoneRecords(invalidSample, invalidCount);
  return out;
}

function aggregateValue(agg: Aggregate): number | null {
  return agg.sold > 0 ? agg.revenue / agg.sold : null;
}

function issuedByZoneForSector(
  agg: KeyedAgg | undefined,
  matchId: string,
  sector: Sector,
): Partial<Record<PriceZone, number>> {
  if (!agg) return {};
  const issued: Partial<Record<PriceZone, number>> = {};
  for (const zone of allowedPriceZonesForSector(sector)) {
    const cell = agg.get(comboKey(matchId, sector, zone));
    if (cell && cell.issued > 0) issued[zone] = cell.issued;
  }
  return issued;
}

/**
 * Venue seat inventory for occupancy denominators.
 * Built from per-sector capacities (arena map), split across allowed zones only.
 * When sales exist, zone slices are enlarged to cover issued (taken from
 * unused zones in the same sector) so combo occupancy stays ≤ 100% when
 * issued fits in the sector.
 */
export function buildAvailabilityIndex(
  matchesById: Map<string, Match>,
  agg?: KeyedAgg,
): AvailabilityIndex {
  const zoneInMatch = new Map<string, number>();
  const sectorInMatch = new Map<string, number>();
  const zoneInSector = new Map<string, number>();
  const leftoverByMatch = new Map<string, number>();

  for (const match of matchesById.values()) {
    const sectors = getSectorCapacitiesForMatch(match);
    if (!sectors) {
      leftoverByMatch.set(match.id, match.capacity);
      continue;
    }

    let comboSum = 0;
    for (const sector of ALL_SECTORS) {
      const sectorCap = sectors[sector] ?? 0;
      if (sectorCap > 0) {
        sectorInMatch.set(`${match.id}|${sector}`, sectorCap);
      }
      const zoneMasses = splitSectorCapacityForDemand(
        sector,
        sectorCap,
        issuedByZoneForSector(agg, match.id, sector),
      );
      for (const zone of allowedPriceZonesForSector(sector)) {
        const mass = zoneMasses[zone] ?? 0;
        if (!(mass > 0)) continue;
        const key = comboKey(match.id, sector, zone);
        zoneInSector.set(key, mass);
        const zoneKey = `${match.id}|${zone}`;
        zoneInMatch.set(zoneKey, (zoneInMatch.get(zoneKey) ?? 0) + mass);
        comboSum += mass;
      }
    }
    leftoverByMatch.set(match.id, match.capacity - comboSum);
  }

  return { zoneInMatch, sectorInMatch, zoneInSector, leftoverByMatch };
}

export function occupancyPercent(
  issued: number,
  availableMass: number,
): number | null {
  if (!(availableMass > 0)) return null;
  return Math.min(100, (issued / availableMass) * 100);
}

export function computeOccupancy(
  matchId: string,
  sectorId: Sector,
  zoneId: PriceZone,
  issued: { inZone: number; inSector: number; inCombo: number },
  availability: AvailabilityIndex,
): OccupancyValues {
  const zoneDen = availability.zoneInMatch.get(`${matchId}|${zoneId}`) ?? 0;
  const sectorDen = availability.sectorInMatch.get(`${matchId}|${sectorId}`) ?? 0;
  const pairDen = availability.zoneInSector.get(comboKey(matchId, sectorId, zoneId)) ?? 0;
  return {
    zoneInMatch: occupancyPercent(issued.inZone, zoneDen),
    sectorInMatch: occupancyPercent(issued.inSector, sectorDen),
    zoneInSector: occupancyPercent(issued.inCombo, pairDen),
  };
}

export function resolveAllowedCell(
  matchId: string,
  sectorId: Sector,
  zoneId: PriceZone,
  sliceAgg: KeyedAgg,
  availability: AvailabilityIndex,
): AllowedCellDisplay {
  const key = comboKey(matchId, sectorId, zoneId);
  const agg = sliceAgg.get(key);
  const pairMass = availability.zoneInSector.get(key) ?? 0;
  const hasMass = pairMass > 0;
  const hasSliceActivity =
    !!agg && (agg.issued > 0 || agg.sold > 0 || agg.free > 0 || agg.revenue > 0);

  if (hasSliceActivity && agg) {
    return {
      revenue: agg.revenue,
      sold: agg.sold,
      free: agg.free,
      issued: agg.issued,
      avgPrice: aggregateValue(agg),
      occupancy: occupancyPercent(agg.issued, pairMass),
      kind: "values",
    };
  }

  if (hasMass) {
    return {
      revenue: 0,
      sold: 0,
      free: 0,
      issued: 0,
      avgPrice: null,
      occupancy: 0,
      kind: "zeros",
    };
  }

  return {
    revenue: null,
    sold: null,
    free: null,
    issued: null,
    avgPrice: null,
    occupancy: null,
    kind: "dash",
  };
}

export function emptyAggregate(): Aggregate {
  return createAggregate();
}

export function sumAllowedCombos(
  matchId: string,
  agg: KeyedAgg,
  selectedZones: readonly PriceZone[] = [],
  selectedSectors: readonly Sector[] = [],
): Aggregate {
  const totals = createAggregate();
  const sectors = visibleSectorsForFilters(selectedZones, selectedSectors);
  const zones = visiblePriceZonesForFilters(selectedZones, selectedSectors);
  for (const sector of sectors) {
    for (const zone of allowedPriceZonesForSector(sector)) {
      if (!zones.includes(zone)) continue;
      const cell = agg.get(comboKey(matchId, sector, zone));
      if (cell) addAggregate(totals, cell);
    }
  }
  return totals;
}

export function sumMatchBySectors(
  matchId: string,
  agg: KeyedAgg,
  selectedZones: readonly PriceZone[] = [],
  selectedSectors: readonly Sector[] = [],
): Aggregate {
  return sumAllowedCombos(matchId, agg, selectedZones, selectedSectors);
}

export function sumMatchByZones(
  matchId: string,
  agg: KeyedAgg,
  selectedZones: readonly PriceZone[] = [],
  selectedSectors: readonly Sector[] = [],
): Aggregate {
  return sumAllowedCombos(matchId, agg, selectedZones, selectedSectors);
}

export function buildMatrixRows(options: BuildOptions): MatrixRow[] {
  if (
    !hasAllowedFilterIntersection(options.localPriceZones, options.localSectors)
  ) {
    return [];
  }

  const matchFilterSet = options.localMatchIds.length
    ? new Set(options.localMatchIds)
    : null;
  const visibleZones = visiblePriceZonesForFilters(
    options.localPriceZones,
    options.localSectors,
  );
  const visibleSectors = visibleSectorsForFilters(
    options.localPriceZones,
    options.localSectors,
  );
  const zoneFilterSet = new Set(visibleZones);
  const sectorFilterSet = new Set(visibleSectors);

  const sliceAgg = preAggregateZoneSector(
    options.transactions,
    options.matchesById,
  );

  const rows = new Map<string, MatrixRow>();

  for (const [key, agg] of sliceAgg) {
    const [matchId, sectorId, zoneId] = key.split("|") as [string, Sector, PriceZone];
    if (matchFilterSet && !matchFilterSet.has(matchId)) continue;
    if (!zoneFilterSet.has(zoneId)) continue;
    if (!sectorFilterSet.has(sectorId)) continue;
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
  _matchId: string,
  sectorId: Sector,
  _agg?: KeyedAgg,
  selectedZones: readonly PriceZone[] = [],
): PriceZone[] {
  const allowed = allowedPriceZonesForSector(sectorId);
  if (!selectedZones.length) return allowed;
  return allowed.filter((zone) => selectedZones.includes(zone));
}

export function inferChildSectorsForZone(
  _matchId: string,
  zoneId: PriceZone,
  _agg?: KeyedAgg,
  selectedSectors: readonly Sector[] = [],
): Sector[] {
  const allowed = allowedSectorsForPriceZone(zoneId);
  if (!selectedSectors.length) return allowed;
  return allowed.filter((sector) => selectedSectors.includes(sector));
}

export function hierarchyParentsForMode(
  mode: DetailMode,
  selectedZones: readonly PriceZone[] = [],
  selectedSectors: readonly Sector[] = [],
): Array<{ kind: "zone"; id: PriceZone } | { kind: "sector"; id: Sector }> {
  if (mode === "zones_to_sectors") {
    return visiblePriceZonesForFilters(selectedZones, selectedSectors).map((id) => ({
      kind: "zone" as const,
      id,
    }));
  }
  return visibleSectorsForFilters(selectedZones, selectedSectors).map((id) => ({
    kind: "sector" as const,
    id,
  }));
}

function occupancyFromMass(issued: number, mass: number): number | null {
  return occupancyPercent(issued, mass);
}

function comboMassForLeaf(
  availability: AvailabilityIndex,
  matchId: string,
  leaf: Pick<ZoneSectorTreeNode, "sectorId" | "zoneId" | "kind">,
): number {
  if (leaf.kind === "dash" || !leaf.sectorId || !leaf.zoneId) return 0;
  return availability.zoneInSector.get(comboKey(matchId, leaf.sectorId, leaf.zoneId)) ?? 0;
}

function massFromLeaves(
  availability: AvailabilityIndex,
  matchId: string,
  leaves: ZoneSectorTreeNode[],
): number {
  let mass = 0;
  for (const leaf of leaves) {
    mass += comboMassForLeaf(availability, matchId, leaf);
  }
  return mass;
}

function rollupKind(children: ZoneSectorTreeNode[]): AllowedCellKind {
  if (children.some((child) => child.kind === "values")) return "values";
  if (children.some((child) => child.kind === "zeros")) return "zeros";
  return "dash";
}

function rollupChildren(
  children: ZoneSectorTreeNode[],
  occupancy: number | null,
): Pick<
  ZoneSectorTreeNode,
  "kind" | "revenue" | "sold" | "free" | "issued" | "avgPrice" | "occupancy"
> {
  const kind = rollupKind(children);
  if (kind === "dash") {
    return {
      kind,
      revenue: null,
      sold: null,
      free: null,
      issued: null,
      avgPrice: null,
      occupancy: null,
    };
  }
  let revenue = 0;
  let sold = 0;
  let free = 0;
  let issued = 0;
  for (const child of children) {
    if (child.kind === "dash") continue;
    revenue += child.revenue ?? 0;
    sold += child.sold ?? 0;
    free += child.free ?? 0;
    issued += child.issued ?? 0;
  }
  return {
    kind,
    revenue,
    sold,
    free,
    issued,
    avgPrice: sold > 0 ? revenue / sold : null,
    occupancy,
  };
}

function leafFromCell(
  id: string,
  matchId: string,
  label: string,
  cell: AllowedCellDisplay,
  extras: { zoneId?: PriceZone; sectorId?: Sector },
): ZoneSectorTreeNode {
  return {
    id,
    level: "leaf",
    matchId,
    date: null,
    label,
    zoneId: extras.zoneId,
    sectorId: extras.sectorId,
    kind: cell.kind,
    revenue: cell.revenue,
    sold: cell.sold,
    free: cell.free,
    issued: cell.issued,
    avgPrice: cell.avgPrice,
    occupancy: cell.occupancy,
    hasChildren: false,
    children: [],
  };
}

function issuedFromNodes(nodes: ZoneSectorTreeNode[]): number {
  let issued = 0;
  for (const node of nodes) {
    if (node.kind === "dash") continue;
    issued += node.issued ?? 0;
  }
  return issued;
}

function isZeroSaleRow(node: ZoneSectorTreeNode): boolean {
  return (node.issued ?? 0) === 0 && (node.revenue ?? 0) === 0;
}

function visibleTreeChildren(nodes: ZoneSectorTreeNode[]): ZoneSectorTreeNode[] {
  return nodes.filter((node) => !isZeroSaleRow(node));
}

function matchTotalsKind(totals: Aggregate): AllowedCellKind {
  if (totals.issued > 0 || totals.sold > 0 || totals.free > 0 || totals.revenue > 0) {
    return "values";
  }
  return "dash";
}

function buildSectionChildren(
  matchId: string,
  options: ZoneSectorTreeContext & { mode: DetailMode },
): ZoneSectorTreeNode[] {
  const { agg, availability } = options;
  if (options.mode === "zones_to_sectors") {
    const visibleZones = visiblePriceZonesForFilters(
      options.localPriceZones,
      options.localSectors,
    );
    return visibleZones.map((zone) => {
      const sectors = inferChildSectorsForZone(
        matchId,
        zone,
        agg,
        options.localSectors,
      );
      const leaves = sectors.map((sector) =>
        leafFromCell(
          `m:${matchId}|z:${zone}|s:${sector}`,
          matchId,
          sector,
          resolveAllowedCell(matchId, sector, zone, agg, availability),
          { zoneId: zone, sectorId: sector },
        ),
      );
      const mass = massFromLeaves(availability, matchId, leaves);
      const visibleLeaves = visibleTreeChildren(leaves);
      const kind = rollupKind(leaves);
      return {
        id: `m:${matchId}|z:${zone}`,
        level: "section" as const,
        matchId,
        date: null,
        label: PRICE_ZONE_LABELS[zone],
        zoneId: zone,
        ...rollupChildren(
          leaves,
          kind === "dash" ? null : occupancyFromMass(issuedFromNodes(leaves), mass),
        ),
        hasChildren: visibleLeaves.length > 0,
        children: visibleLeaves,
      };
    }).filter((section) => !isZeroSaleRow(section));
  }

  const visibleSectors = visibleSectorsForFilters(
    options.localPriceZones,
    options.localSectors,
  );
  return visibleSectors.map((sector) => {
    const zones = inferChildZonesForSector(
      matchId,
      sector,
      agg,
      options.localPriceZones,
    );
    const leaves = zones.map((zone) =>
      leafFromCell(
        `m:${matchId}|s:${sector}|z:${zone}`,
        matchId,
        PRICE_ZONE_LABELS[zone],
        resolveAllowedCell(matchId, sector, zone, agg, availability),
        { zoneId: zone, sectorId: sector },
      ),
    );
    const mass = massFromLeaves(availability, matchId, leaves);
    const visibleLeaves = visibleTreeChildren(leaves);
    const kind = rollupKind(leaves);
    return {
      id: `m:${matchId}|s:${sector}`,
      level: "section" as const,
      matchId,
      date: null,
      label: sector,
      sectorId: sector,
      ...rollupChildren(
        leaves,
        kind === "dash" ? null : occupancyFromMass(issuedFromNodes(leaves), mass),
      ),
      hasChildren: visibleLeaves.length > 0,
      children: visibleLeaves,
    };
  }).filter((section) => !isZeroSaleRow(section));
}

/**
 * Match-level rows only. Children stay empty until hydrateZoneSectorTree
 * so callers can paginate before building zone/sector leaves.
 */
export function buildZoneSectorMatchTree(
  options: ZoneSectorTreeContext,
): ZoneSectorTreeNode[] {
  if (
    !hasAllowedFilterIntersection(options.localPriceZones, options.localSectors)
  ) {
    return [];
  }

  const matchFilterSet = options.localMatchIds.length
    ? new Set(options.localMatchIds)
    : null;
  const visibleZones = visiblePriceZonesForFilters(
    options.localPriceZones,
    options.localSectors,
  );
  const visibleSectors = visibleSectorsForFilters(
    options.localPriceZones,
    options.localSectors,
  );
  const zoneSet = new Set(visibleZones);
  const sectorSet = new Set(visibleSectors);
  const matchIds = new Set<string>();

  for (const key of options.agg.keys()) {
    const [matchId, sectorId, zoneId] = key.split("|") as [string, Sector, PriceZone];
    if (matchFilterSet && !matchFilterSet.has(matchId)) continue;
    if (!zoneSet.has(zoneId) || !sectorSet.has(sectorId)) continue;
    matchIds.add(matchId);
  }

  const hasChildren =
    hierarchyParentsForMode(
      "zones_to_sectors",
      options.localPriceZones,
      options.localSectors,
    ).length > 0;

  return [...options.matchesById.values()]
    .filter((match) => matchIds.has(match.id))
    .sort((a, b) => b.date.getTime() - a.date.getTime())
    .map((match) => {
      const totals = sumAllowedCombos(
        match.id,
        options.agg,
        options.localPriceZones,
        options.localSectors,
      );
      const kind = matchTotalsKind(totals);
      const capacity = match.capacity > 0 ? match.capacity : 0;
      const metrics =
        kind === "dash"
          ? {
              kind,
              revenue: null,
              sold: null,
              free: null,
              issued: null,
              avgPrice: null,
              occupancy: null,
            }
          : {
              kind,
              revenue: totals.revenue,
              sold: totals.sold,
              free: totals.free,
              issued: totals.issued,
              avgPrice: totals.sold > 0 ? totals.revenue / totals.sold : null,
              occupancy: occupancyFromMass(totals.issued, capacity),
            };
      return {
        id: `m:${match.id}`,
        level: "match" as const,
        matchId: match.id,
        date: match.date,
        label: `${match.opponent} ${format(match.date, "dd-MM-yy", { locale: ru })}`,
        ...metrics,
        hasChildren,
        children: [] as ZoneSectorTreeNode[],
      };
    });
}

/** Attach zone/sector children for the given match rows. Does not mutate input. */
export function hydrateZoneSectorTree(
  matchNodes: ZoneSectorTreeNode[],
  options: ZoneSectorTreeContext & { mode: DetailMode },
): ZoneSectorTreeNode[] {
  return matchNodes.map((node) => {
    const children = buildSectionChildren(node.matchId, options);
    const match = options.matchesById.get(node.matchId);
    const capacity = match && match.capacity > 0 ? match.capacity : 0;
    return {
      ...node,
      ...rollupChildren(
        children,
        occupancyFromMass(issuedFromNodes(children), capacity),
      ),
      hasChildren: children.length > 0,
      children,
    };
  });
}

export function buildZoneSectorTree(
  options: BuildOptions & { mode: DetailMode },
): ZoneSectorTreeNode[] {
  if (
    !hasAllowedFilterIntersection(options.localPriceZones, options.localSectors)
  ) {
    return [];
  }

  const agg = preAggregateZoneSector(options.transactions, options.matchesById);
  const ctx: ZoneSectorTreeContext = {
    agg,
    availability: buildAvailabilityIndex(options.matchesById, agg),
    matchesById: options.matchesById,
    localMatchIds: options.localMatchIds,
    localPriceZones: options.localPriceZones,
    localSectors: options.localSectors,
  };
  return hydrateZoneSectorTree(buildZoneSectorMatchTree(ctx), {
    ...ctx,
    mode: options.mode,
  });
}

export function flattenZoneSectorTree(
  nodes: ZoneSectorTreeNode[],
  expanded: ReadonlySet<string>,
): ZoneSectorFlatRow[] {
  const rows: ZoneSectorFlatRow[] = [];
  const walk = (node: ZoneSectorTreeNode, depth: number) => {
    const { children, ...rest } = node;
    rows.push({ ...rest, depth, hasChildren: node.hasChildren || children.length > 0 });
    if (!node.hasChildren || !expanded.has(node.id)) return;
    for (const child of children) walk(child, depth + 1);
  };
  for (const node of nodes) walk(node, 0);
  return rows;
}

export function matchZoneSectorTreeQuery(
  node: ZoneSectorTreeNode,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  const dateText = node.date
    ? node.date.toLocaleDateString("ru-RU")
    : "";
  return `${node.label} ${dateText}`.toLowerCase().includes(q);
}

export { ALL_PRICE_ZONES, ALL_SECTORS, PRICE_ZONE_LABELS };
