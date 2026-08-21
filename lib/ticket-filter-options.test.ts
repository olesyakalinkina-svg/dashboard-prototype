import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ALL_PRICE_ZONES,
  ALL_SECTORS,
  applyTicketFilterPatch,
  arenaForSelectedLeague,
  buildMatchFilterOptions,
  buildSeriesFilterOptions,
  DEFAULT_TICKET_FILTERS,
  getSectorOptionsForPriceZone,
  isLeagueArenaLocked,
  isNoSectorsFilterValue,
  KHL_SERIES_ORDER,
  NO_SECTORS_FILTER_VALUE,
  passesSectorFilter,
  passesSeriesFilter,
  PRICE_ZONE_LABELS,
  PRICE_ZONE_OPTIONS,
  sanitizeLeagueArena,
  sanitizeSectorsForPriceZone,
  sanitizeSeriesForOptions,
  SECTOR_OPTIONS,
} from "@/lib/ticket-filter-options";
import { applyMatchSalesFilterPatch, DEFAULT_MATCH_SALES_FILTERS } from "@/lib/match-sales-filter-options";
import type { Match } from "@/types/dashboard";

describe("ticket sector filter options", () => {
  it("lists seating sectors A, B1–B4, C1–C4, D1–D4, VIP and not parking", () => {
    expect(SECTOR_OPTIONS.map((opt) => opt.value)).toEqual(ALL_SECTORS);
    expect(SECTOR_OPTIONS.map((opt) => opt.label)).toEqual([
      "A",
      "B1",
      "B2",
      "B3",
      "B4",
      "C1",
      "C2",
      "C3",
      "C4",
      "D1",
      "D2",
      "D3",
      "D4",
      "VIP",
    ]);
    expect(SECTOR_OPTIONS.some((opt) => /парк/i.test(opt.label))).toBe(false);
    expect(DEFAULT_TICKET_FILTERS.sector).toEqual([]);
  });

  it("narrows sector options to the price-zone matrix", () => {
    expect(getSectorOptionsForPriceZone("all").map((opt) => opt.value)).toEqual(
      ALL_SECTORS,
    );
    expect(
      getSectorOptionsForPriceZone("from_2500_to_3000").map((opt) => opt.value),
    ).toEqual(ALL_SECTORS);
    expect(
      getSectorOptionsForPriceZone("up_to_500").map((opt) => opt.value),
    ).toEqual(ALL_SECTORS.filter((sector) => sector !== "VIP"));
  });

  it("treats empty selection as all sectors and drops parking txs when restricted", () => {
    expect(passesSectorFilter("A", [])).toBe(true);
    expect(passesSectorFilter(undefined, [])).toBe(true);
    expect(passesSectorFilter("A", ["A", "B1"])).toBe(true);
    expect(passesSectorFilter("VIP", ["A", "B1"])).toBe(false);
    expect(passesSectorFilter(undefined, ["A"])).toBe(false);
    expect(passesSectorFilter("A", [NO_SECTORS_FILTER_VALUE])).toBe(false);
  });

  it("sanitizes a VIP-only pick when the price zone no longer allows VIP", () => {
    expect(sanitizeSectorsForPriceZone(["VIP"], "from_2500_to_3000")).toEqual([
      "VIP",
    ]);
    expect(sanitizeSectorsForPriceZone(["VIP"], "up_to_500")).toEqual([
      NO_SECTORS_FILTER_VALUE,
    ]);
    expect(isNoSectorsFilterValue(sanitizeSectorsForPriceZone(["VIP"], "up_to_500"))).toBe(
      true,
    );
    expect(sanitizeSectorsForPriceZone(["A", "VIP"], "up_to_500")).toEqual(["A"]);
    expect(sanitizeSectorsForPriceZone([], "from_2500_to_3000")).toEqual([]);
  });
});

describe("ticket price zone labels", () => {
  it("shows only the six band numbers, without от/до/₽", () => {
    expect(ALL_PRICE_ZONES.map((zone) => PRICE_ZONE_LABELS[zone])).toEqual([
      "500",
      "1000",
      "1500",
      "2000",
      "2500",
      "3000",
    ]);
    expect(PRICE_ZONE_OPTIONS.map((opt) => opt.label)).toEqual([
      "Все зоны",
      "500",
      "1000",
      "1500",
      "2000",
      "2500",
      "3000",
    ]);
    for (const zone of ALL_PRICE_ZONES) {
      const label = PRICE_ZONE_LABELS[zone];
      expect(label).toMatch(/^\d+$/);
      expect(label).not.toMatch(/от|до|₽/);
    }
  });
});

describe("ticket series filter options", () => {
  it("defaults to all series and lists KHL calendar labels in order", () => {
    expect(DEFAULT_TICKET_FILTERS.series).toBe("all");
    const matches = KHL_SERIES_ORDER.map((series, index) => ({
      series,
      date: new Date(2025, 8, index + 1),
    })) as Match[];
    expect(buildSeriesFilterOptions(matches).map((opt) => opt.label)).toEqual([
      "Все серии",
      ...KHL_SERIES_ORDER,
    ]);
  });

  it("omits series when the current matches have none", () => {
    expect(buildSeriesFilterOptions([{ series: undefined } as Match])).toEqual([
      { value: "all", label: "Все серии" },
    ]);
  });

  it("sanitizes a playoff series when the stage is regular", () => {
    const regularOptions = buildSeriesFilterOptions([
      { series: "Сентябрь" } as Match,
      { series: "Февраль-Март" } as Match,
    ]);
    expect(sanitizeSeriesForOptions("ПО. Ак Барс", regularOptions)).toBe("all");
    expect(sanitizeSeriesForOptions("Сентябрь", regularOptions)).toBe("Сентябрь");
    expect(passesSeriesFilter("Сентябрь", "all")).toBe(true);
    expect(passesSeriesFilter("Сентябрь", "Сентябрь")).toBe(true);
    expect(passesSeriesFilter("ПО. Ак Барс", "Сентябрь")).toBe(false);
    expect(passesSeriesFilter(undefined, "Сентябрь")).toBe(false);
  });
});

describe("buildMatchFilterOptions", () => {
  it("labels matches with opponent and date, without a vs prefix", () => {
    const options = buildMatchFilterOptions([
      {
        id: "m1",
        date: new Date(2026, 4, 17),
        opponent: "Динамо Москва",
        attendance: 0,
        capacity: 0,
        season: "2025/26",
        league: "KHL",
        tournamentStage: "regular",
        matchClass: "class_1",
        series: "Сентябрь",
        arena: "main",
        eventCompleted: true,
        ticketSalesWindowDays: 12,
      },
    ]);
    expect(options[0]!.label).toBe("Динамо Москва · 17 мая 2026 · Сентябрь");
    expect(options[0]!.label.includes("vs ")).toBe(false);
  });
});

describe("league arena lock", () => {
  it("locks VHL to secondary and MHL to main, leaving KHL and Все free", () => {
    expect(isLeagueArenaLocked("VHL")).toBe(true);
    expect(isLeagueArenaLocked("MHL")).toBe(true);
    expect(isLeagueArenaLocked("KHL")).toBe(false);
    expect(isLeagueArenaLocked("all")).toBe(false);

    expect(sanitizeLeagueArena("VHL", "all")).toBe("secondary");
    expect(sanitizeLeagueArena("VHL", "main")).toBe("secondary");
    expect(sanitizeLeagueArena("MHL", "secondary")).toBe("main");
    expect(sanitizeLeagueArena("KHL", "all")).toBe("all");
    expect(sanitizeLeagueArena("KHL", "secondary")).toBe("secondary");
    expect(sanitizeLeagueArena("all", "secondary")).toBe("secondary");

    expect(arenaForSelectedLeague("KHL", "secondary")).toBe("all");
    expect(arenaForSelectedLeague("KHL", "main")).toBe("all");
    expect(arenaForSelectedLeague("VHL", "all")).toBe("secondary");
    expect(arenaForSelectedLeague("MHL", "secondary")).toBe("main");
    expect(arenaForSelectedLeague("all", "secondary")).toBe("secondary");
  });

  it("forces secondary when patching tickets or match sales to VHL", () => {
    const ticketsVhl = applyTicketFilterPatch(DEFAULT_TICKET_FILTERS, {
      league: "VHL",
    });
    expect(ticketsVhl.arena).toBe("secondary");

    const ticketsMhl = applyTicketFilterPatch(ticketsVhl, { league: "MHL" });
    expect(ticketsMhl.arena).toBe("main");

    const ticketsKhl = applyTicketFilterPatch(ticketsVhl, { league: "KHL" });
    expect(ticketsKhl.arena).toBe("all");

    const ticketsKhlFromMhl = applyTicketFilterPatch(ticketsMhl, {
      league: "KHL",
    });
    expect(ticketsKhlFromMhl.arena).toBe("all");

    const ticketsKhlFromAll = applyTicketFilterPatch(
      { ...DEFAULT_TICKET_FILTERS, league: "all", arena: "secondary" },
      { league: "KHL" },
    );
    expect(ticketsKhlFromAll.arena).toBe("all");

    const ticketsKhlKeep = applyTicketFilterPatch(ticketsKhl, {
      arena: "secondary",
    });
    expect(ticketsKhlKeep.arena).toBe("secondary");

    const matchesVhl = applyMatchSalesFilterPatch(DEFAULT_MATCH_SALES_FILTERS, {
      league: "VHL",
    });
    expect(matchesVhl.arena).toBe("secondary");

    const matchesKhl = applyMatchSalesFilterPatch(matchesVhl, { league: "KHL" });
    expect(matchesKhl.arena).toBe("all");

    const matchesMain = applyMatchSalesFilterPatch(DEFAULT_MATCH_SALES_FILTERS, {
      league: "VHL",
      arena: "main",
    });
    expect(matchesMain.arena).toBe("secondary");
  });

  it("applies the lock in live and mobile draft filter setters", () => {
    const filterContext = readFileSync(
      join(process.cwd(), "context/FilterContext.tsx"),
      "utf8",
    );
    const mobileDraft = readFileSync(
      join(process.cwd(), "context/MobileFilterDraftContext.tsx"),
      "utf8",
    );
    expect(filterContext).toContain("applyTicketFilterPatch");
    expect(filterContext).toContain("applyMatchSalesFilterPatch");
    expect(filterContext).toContain("applySubscriptionFilterPatch");
    expect(mobileDraft).toContain("applyTicketFilterPatch");
    expect(mobileDraft).toContain("applyMatchSalesFilterPatch");
    expect(mobileDraft).toContain("applySubscriptionFilterPatch");
  });
});
