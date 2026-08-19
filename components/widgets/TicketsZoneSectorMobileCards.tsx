"use client";

import clsx from "clsx";
import { memo } from "react";
import { InlineBarCell } from "@/components/ui/InlineBarCell";
import { formatCurrency, formatDate, formatPercent } from "@/lib/format";
import type { ZoneSectorTreeNode } from "@/lib/tickets-zone-sector-analytics";

function capOccupancyPct(occupancy: number): number {
  return Math.min(100, occupancy);
}

function barClass(
  level: ZoneSectorTreeNode["level"],
  matchClass: string,
  sectionClass: string,
  leafClass: string,
): string {
  if (level === "match") return matchClass;
  if (level === "section") return sectionClass;
  return leafClass;
}

function rowTestAttrs(row: ZoneSectorTreeNode) {
  const parentId = row.id.includes("|")
    ? row.id.slice(0, row.id.lastIndexOf("|"))
    : undefined;
  return {
    "data-tree-level": row.level,
    "data-tree-id": row.id,
    ...(row.level === "section" && row.zoneId ? { "data-parent-zone": row.zoneId } : {}),
    ...(row.level === "section" && row.sectorId ? { "data-parent-sector": row.sectorId } : {}),
    ...(row.level === "leaf" && row.zoneId ? { "data-child-zone": row.zoneId } : {}),
    ...(row.level === "leaf" && row.sectorId ? { "data-child-sector": row.sectorId } : {}),
    ...(row.level === "leaf" && parentId ? { "data-tree-parent": parentId } : {}),
  };
}

function MetricBars({
  item,
  revenueMax,
}: {
  item: ZoneSectorTreeNode;
  revenueMax: number;
}) {
  const occupancy =
    item.occupancy == null ? null : capOccupancyPct(item.occupancy);
  const fulfillmentPct =
    item.revenue != null && item.planRevenue != null && item.planRevenue > 0
      ? (item.revenue / item.planRevenue) * 100
      : null;
  const showPlanPct = item.level === "match";

  return (
    <dl className="mt-2.5 grid grid-cols-1 gap-2 text-xs leading-snug">
      <div className="min-w-0">
        <dt className="text-[var(--muted)]">Выручка</dt>
        <dd className="mt-0.5 min-w-0">
          {item.revenue == null ? (
            <span className="text-[var(--muted)]">—</span>
          ) : (
            <InlineBarCell
              value={item.revenue}
              max={revenueMax}
              share={fulfillmentPct ?? undefined}
              formatted={formatCurrency(item.revenue)}
              trailingFormatted={
                showPlanPct
                  ? fulfillmentPct !== null
                    ? formatPercent(fulfillmentPct)
                    : "—"
                  : undefined
              }
              barClassName={barClass(
                item.level,
                "bg-rose-400",
                "bg-rose-300",
                "bg-rose-200",
              )}
            />
          )}
        </dd>
      </div>
      <div className="min-w-0">
        <dt className="text-[var(--muted)]">Заполняемость</dt>
        <dd className="mt-0.5 min-w-0">
          {occupancy == null ? (
            <span className="text-[var(--muted)]">—</span>
          ) : (
            <InlineBarCell
              value={occupancy}
              max={100}
              share={occupancy}
              formatted={formatPercent(occupancy)}
              barClassName={barClass(
                item.level,
                "bg-emerald-500",
                "bg-emerald-300",
                "bg-emerald-200",
              )}
            />
          )}
        </dd>
      </div>
    </dl>
  );
}

const NestedBranch = memo(function NestedBranch({
  node,
  expandedSet,
  toggleExpanded,
  revenueMax,
}: {
  node: ZoneSectorTreeNode;
  expandedSet: ReadonlySet<string>;
  toggleExpanded: (id: string) => void;
  revenueMax: number;
}) {
  const expanded = expandedSet.has(node.id);
  const hasChildren = node.hasChildren || node.children.length > 0;

  return (
    <div
      className="rounded-md border border-[var(--border)] border-l-4 p-2.5"
      {...rowTestAttrs(node)}
    >
      <p
        className={clsx(
          "break-words text-xs font-medium leading-snug",
          node.level === "leaf" ? "text-[var(--muted)]" : "text-[var(--foreground)]",
        )}
      >
        {node.label}
      </p>
      <MetricBars item={node} revenueMax={revenueMax} />
      {hasChildren && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleExpanded(node.id);
          }}
          className="mt-2 min-h-11 w-full rounded-md border border-[var(--border)] text-xs font-medium"
          aria-expanded={expanded}
          aria-label={
            expanded ? `Свернуть: ${node.label}` : `Развернуть: ${node.label}`
          }
        >
          {expanded ? "Скрыть детализацию" : "Показать детализацию"}
        </button>
      )}
      {hasChildren && expanded && (
        <div className="mt-2 space-y-2 pl-2">
          {node.children.map((child) => (
            <NestedBranch
              key={child.id}
              node={child}
              expandedSet={expandedSet}
              toggleExpanded={toggleExpanded}
              revenueMax={revenueMax}
            />
          ))}
        </div>
      )}
    </div>
  );
});

const MatchCard = memo(function MatchCard({
  row,
  expandedSet,
  toggleExpanded,
  revenueMax,
}: {
  row: ZoneSectorTreeNode;
  expandedSet: ReadonlySet<string>;
  toggleExpanded: (id: string) => void;
  revenueMax: number;
}) {
  const expanded = expandedSet.has(row.id);
  const hasChildren = row.hasChildren || row.children.length > 0;

  return (
    <article
      className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
      data-testid="zone-sector-mobile-card"
      {...rowTestAttrs(row)}
    >
      <p
        className={clsx(
          "min-w-0 break-words text-sm font-medium leading-snug text-[var(--foreground)]",
        )}
        data-testid="zone-sector-mobile-title"
      >
        {row.label}
      </p>
      {row.date ? (
        <p
          className="mt-0.5 text-xs leading-snug text-[var(--muted)]"
          data-testid="zone-sector-mobile-date"
        >
          {formatDate(row.date)}
        </p>
      ) : null}
      <MetricBars item={row} revenueMax={revenueMax} />
      {hasChildren && (
        <button
          type="button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            toggleExpanded(row.id);
          }}
          className="mt-3 min-h-11 w-full rounded-md border border-[var(--border)] bg-white text-sm font-medium"
          aria-expanded={expanded}
          aria-label={
            expanded ? `Свернуть: ${row.label}` : `Развернуть: ${row.label}`
          }
        >
          {expanded ? "Скрыть детализацию" : "Показать детализацию"}
        </button>
      )}
      {hasChildren && expanded && (
        <div className="mt-2 space-y-2">
          {row.children.map((child) => (
            <NestedBranch
              key={child.id}
              node={child}
              expandedSet={expandedSet}
              toggleExpanded={toggleExpanded}
              revenueMax={revenueMax}
            />
          ))}
        </div>
      )}
    </article>
  );
});

export const TicketsZoneSectorMobileCards = memo(
  function TicketsZoneSectorMobileCards({
    rows,
    expandedSet,
    toggleExpanded,
    revenueMax,
  }: {
    rows: ZoneSectorTreeNode[];
    expandedSet: ReadonlySet<string>;
    toggleExpanded: (id: string) => void;
    revenueMax: number;
  }) {
    if (rows.length === 0) {
      return (
        <p className="py-6 text-center text-sm text-[var(--muted)]">Нет данных</p>
      );
    }

    return (
      <div className="space-y-3" data-testid="zone-sector-mobile-cards">
        {rows.map((row) => (
          <MatchCard
            key={row.id}
            row={row}
            expandedSet={expandedSet}
            toggleExpanded={toggleExpanded}
            revenueMax={revenueMax}
          />
        ))}
      </div>
    );
  },
);
