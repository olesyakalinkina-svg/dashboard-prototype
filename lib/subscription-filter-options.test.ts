import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  applySubscriptionFilterPatch,
  DEFAULT_SUBSCRIPTION_FILTERS,
  isSubscriptionArenaLocked,
  sanitizeSubscriptionArena,
  SUBSCRIPTION_PRICE_CATEGORY_OPTIONS,
} from "@/lib/subscription-filter-options";

describe("subscription filter options", () => {
  it("defaults KHL to all arenas and all product types", () => {
    expect(DEFAULT_SUBSCRIPTION_FILTERS.league).toBe("KHL");
    expect(DEFAULT_SUBSCRIPTION_FILTERS.arena).toBe("all");
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

  it("locks VHL and MHL arenas and leaves KHL and Все лиги free", () => {
    expect(isSubscriptionArenaLocked("KHL")).toBe(false);
    expect(isSubscriptionArenaLocked("VHL")).toBe(true);
    expect(isSubscriptionArenaLocked("MHL")).toBe(true);
    expect(isSubscriptionArenaLocked("all")).toBe(false);

    expect(sanitizeSubscriptionArena("KHL", "all")).toBe("all");
    expect(sanitizeSubscriptionArena("KHL", "secondary")).toBe("secondary");
    expect(sanitizeSubscriptionArena("VHL", "all")).toBe("secondary");
    expect(sanitizeSubscriptionArena("VHL", "main")).toBe("secondary");
    expect(sanitizeSubscriptionArena("MHL", "secondary")).toBe("main");
    expect(sanitizeSubscriptionArena("all", "all")).toBe("all");
    expect(sanitizeSubscriptionArena("all", "secondary")).toBe("secondary");
  });

  it("defaults KHL to all arenas when patching from VHL, MHL, or Все лиги", () => {
    const vhl = applySubscriptionFilterPatch(DEFAULT_SUBSCRIPTION_FILTERS, {
      league: "VHL",
    });
    expect(vhl.arena).toBe("secondary");

    const mhl = applySubscriptionFilterPatch(vhl, { league: "MHL" });
    expect(mhl.arena).toBe("main");

    const backToKhl = applySubscriptionFilterPatch(vhl, {
      league: "KHL",
    });
    expect(backToKhl.arena).toBe("all");
    expect(isSubscriptionArenaLocked(backToKhl.league)).toBe(false);

    const khlFromMhl = applySubscriptionFilterPatch(mhl, { league: "KHL" });
    expect(khlFromMhl.arena).toBe("all");

    const allLeagues = applySubscriptionFilterPatch(vhl, {
      league: "all",
    });
    expect(allLeagues.arena).toBe("secondary");

    const khlFromAll = applySubscriptionFilterPatch(allLeagues, {
      league: "KHL",
    });
    expect(khlFromAll.arena).toBe("all");

    const khlKeep = applySubscriptionFilterPatch(backToKhl, {
      arena: "secondary",
    });
    expect(khlKeep.arena).toBe("secondary");
  });
});

describe("subscription category share chart layout", () => {
  it("places Что покупают under the equal-height pace row, half width, outside renewal", () => {
    const dashboard = readFileSync(
      join(process.cwd(), "app/dashboard-app.tsx"),
      "utf8",
    );
    const subscriptionsStart = dashboard.indexOf(
      '{activeTab === "subscriptions" && (',
    );
    const ticketsStart = dashboard.indexOf('{activeTab === "tickets" && (');
    expect(subscriptionsStart).toBeGreaterThan(-1);
    expect(ticketsStart).toBeGreaterThan(subscriptionsStart);
    const subscriptionsBlock = dashboard.slice(
      subscriptionsStart,
      ticketsStart,
    );

    expect(subscriptionsBlock).toMatch(
      /<SubscriptionCampaignPaceWidget>[\s\S]*SubscriptionPriceCategoryShareChart[\s\S]*<\/SubscriptionCampaignPaceWidget>[\s\S]*<SubscriptionRenewalWidget \/>[\s\S]*<MatchComparisonWidget \/>/,
    );
    expect(subscriptionsBlock).not.toMatch(
      /SubscriptionRenewalWidget[\s\S]*SubscriptionPriceCategoryShareChart/,
    );
    expect(subscriptionsBlock).not.toMatch(
      /MatchComparisonWidget[\s\S]*SubscriptionRenewalWidget/,
    );
    expect(subscriptionsBlock).not.toMatch(
      /grid-cols-1 items-stretch gap-4 min-\[1024px\]:grid-cols-2">[\s\S]*SubscriptionCampaignPaceWidget/,
    );

    const paceWidget = readFileSync(
      join(process.cwd(), "components/widgets/SubscriptionCampaignPaceWidget.tsx"),
      "utf8",
    );
    expect(paceWidget).toMatch(
      /grid min-w-0 grid-cols-1 items-stretch gap-4 min-\[1024px\]:grid-cols-2/,
    );
    expect(paceWidget).toContain('className="flex h-full min-w-0 flex-col"');
    expect(paceWidget).toMatch(
      /COUNT_TITLE[\s\S]*REVENUE_TITLE[\s\S]*\{children \?/,
    );
    expect(paceWidget).not.toMatch(
      /<div className="flex min-w-0 flex-col gap-4">[\s\S]*COUNT_TITLE[\s\S]*\{children\}/,
    );
    expect(paceWidget).toMatch(
      /grid min-w-0 grid-cols-1 items-start gap-4 min-\[1024px\]:grid-cols-2">[\s\S]*\{children\}/,
    );

    const renewalWidget = readFileSync(
      join(process.cwd(), "components/widgets/SubscriptionRenewalWidget.tsx"),
      "utf8",
    );
    expect(renewalWidget).toContain("RenewalProductChart");
    expect(renewalWidget).not.toContain("{children}");
    expect(renewalWidget).toMatch(
      /grid min-w-0 grid-cols-1 items-start gap-4 min-\[1024px\]:grid-cols-2">[\s\S]*<RenewalProductChart/,
    );
    expect(renewalWidget).not.toMatch(
      /grid-cols-1 items-stretch gap-4 min-\[1024px\]:grid-cols-2/,
    );
  });
});
