import { describe, expect, it } from "vitest";
import {
  ALL_SECTORS,
  buildMatchFilterOptions,
  buildSeriesFilterOptions,
  DEFAULT_TICKET_FILTERS,
  getSectorOptionsForPriceZone,
  isNoSectorsFilterValue,
  KHL_SERIES_ORDER,
  NO_SECTORS_FILTER_VALUE,
  passesSectorFilter,
  passesSeriesFilter,
  sanitizeSectorsForPriceZone,
  sanitizeSeriesForOptions,
  SECTOR_OPTIONS,
} from "@/lib/ticket-filter-options";
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
      getSectorOptionsForPriceZone("from_4000_to_6000").map((opt) => opt.value),
    ).toEqual(["VIP"]);
    expect(
      getSectorOptionsForPriceZone("up_to_1500").map((opt) => opt.value),
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
    expect(sanitizeSectorsForPriceZone(["VIP"], "from_4000_to_6000")).toEqual([
      "VIP",
    ]);
    expect(sanitizeSectorsForPriceZone(["VIP"], "up_to_1500")).toEqual([
      NO_SECTORS_FILTER_VALUE,
    ]);
    expect(isNoSectorsFilterValue(sanitizeSectorsForPriceZone(["VIP"], "up_to_1500"))).toBe(
      true,
    );
    expect(sanitizeSectorsForPriceZone(["A", "VIP"], "up_to_1500")).toEqual(["A"]);
    expect(sanitizeSectorsForPriceZone([], "from_4000_to_6000")).toEqual([]);
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
