import { describe, expect, it } from "vitest";
import {
  applySubscriptionFilterPatch,
  DEFAULT_SUBSCRIPTION_FILTERS,
  isSubscriptionArenaLocked,
  sanitizeSubscriptionArena,
  SUBSCRIPTION_PRICE_CATEGORY_OPTIONS,
} from "@/lib/subscription-filter-options";

describe("subscription filter options", () => {
  it("defaults KHL to the main arena and all product types", () => {
    expect(DEFAULT_SUBSCRIPTION_FILTERS.league).toBe("KHL");
    expect(DEFAULT_SUBSCRIPTION_FILTERS.arena).toBe("main");
    expect(DEFAULT_SUBSCRIPTION_FILTERS.priceCategory).toBe("all");
    expect(DEFAULT_SUBSCRIPTION_FILTERS.tournamentStage).toBe("all");
  });

  it("exposes product-type options including Все", () => {
    expect(SUBSCRIPTION_PRICE_CATEGORY_OPTIONS.map((opt) => opt.label)).toEqual([
      "Все",
      "Все включено",
      "Выходного дня",
      "Сезонный",
    ]);
  });

  it("locks arena to the league home venue and leaves it free for Все лиги", () => {
    expect(isSubscriptionArenaLocked("KHL")).toBe(true);
    expect(isSubscriptionArenaLocked("VHL")).toBe(true);
    expect(isSubscriptionArenaLocked("MHL")).toBe(true);
    expect(isSubscriptionArenaLocked("all")).toBe(false);

    expect(sanitizeSubscriptionArena("KHL", "all")).toBe("main");
    expect(sanitizeSubscriptionArena("KHL", "secondary")).toBe("main");
    expect(sanitizeSubscriptionArena("VHL", "all")).toBe("secondary");
    expect(sanitizeSubscriptionArena("VHL", "main")).toBe("secondary");
    expect(sanitizeSubscriptionArena("MHL", "secondary")).toBe("main");
    expect(sanitizeSubscriptionArena("all", "all")).toBe("all");
    expect(sanitizeSubscriptionArena("all", "secondary")).toBe("secondary");
  });

  it("forces the locked arena when patching to a single league", () => {
    const vhl = applySubscriptionFilterPatch(DEFAULT_SUBSCRIPTION_FILTERS, {
      league: "VHL",
    });
    expect(vhl.arena).toBe("secondary");

    const mhl = applySubscriptionFilterPatch(vhl, { league: "MHL" });
    expect(mhl.arena).toBe("main");

    const backToKhl = applySubscriptionFilterPatch(vhl, {
      league: "KHL",
    });
    expect(backToKhl.arena).toBe("main");

    const allLeagues = applySubscriptionFilterPatch(vhl, {
      league: "all",
    });
    expect(allLeagues.arena).toBe("secondary");
  });
});
