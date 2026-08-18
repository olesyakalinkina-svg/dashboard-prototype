/** @vitest-environment jsdom */
import { cleanup, renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import {
  useMatchSalesPageTree,
  useMatchSalesTreeState,
} from "@/hooks/useMatchSalesTree";
import {
  FIXTURE_DASHBOARD_FILTERS,
  FIXTURE_TICKET_FILTERS,
  buildDefaultFixtureTree,
} from "@/lib/match-sales-tree.fixture";

afterEach(() => {
  cleanup();
});

describe("§15 rerenders / expand does not rebuild aggregates", () => {
  it("keeps the same tree instance when toggling expand", () => {
    const pipeline = buildDefaultFixtureTree();
    const { result } = renderHook(() =>
      useMatchSalesTreeState(
        pipeline.rows,
        FIXTURE_DASHBOARD_FILTERS,
        FIXTURE_TICKET_FILTERS,
      ),
    );

    const treeBefore = result.current.tree;
    const matchId = `m:${pipeline.rows[0]!.matchId}`;
    act(() => {
      result.current.toggleExpanded(matchId);
    });
    expect(result.current.tree).toBe(treeBefore);
    expect(result.current.expandedSet.has(matchId)).toBe(true);

    act(() => {
      result.current.toggleExpanded(matchId);
    });
    expect(result.current.tree).toBe(treeBefore);
    expect(result.current.expandedSet.has(matchId)).toBe(false);
  });

  it("does not rebuild the page tree when only expanded ids change", () => {
    const pipeline = buildDefaultFixtureTree();
    const { result, rerender } = renderHook(
      ({ expanded }: { expanded: string[] }) => {
        void expanded;
        return useMatchSalesPageTree(pipeline.tree, {
          matchRows: pipeline.rows,
          filters: FIXTURE_DASHBOARD_FILTERS,
          ticketFilters: FIXTURE_TICKET_FILTERS,
        });
      },
      { initialProps: { expanded: [] as string[] } },
    );

    const before = result.current;
    rerender({ expanded: [pipeline.tree[0]!.id] });
    expect(result.current).toBe(before);
  });

  it("sanitizes expand ids when the match set shrinks", () => {
    const pipeline = buildDefaultFixtureTree();
    const { result, rerender } = renderHook(
      ({ rows }) =>
        useMatchSalesTreeState(
          rows,
          FIXTURE_DASHBOARD_FILTERS,
          FIXTURE_TICKET_FILTERS,
        ),
      { initialProps: { rows: pipeline.rows } },
    );

    const gone = `m:${pipeline.rows[0]!.matchId}`;
    const kept = `m:${pipeline.rows[1]!.matchId}`;
    act(() => {
      result.current.toggleExpanded(gone);
      result.current.toggleExpanded(kept);
    });
    expect(result.current.expandedSet.has(gone)).toBe(true);

    rerender({
      rows: pipeline.rows.filter((row) => `m:${row.matchId}` !== gone),
    });
    expect(result.current.expandedSet.has(gone)).toBe(false);
    expect(result.current.expandedSet.has(kept)).toBe(true);
  });
});
