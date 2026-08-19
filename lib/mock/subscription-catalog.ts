import type {
  League,
  Subscription,
  SubscriptionPlan,
  SubscriptionPriceCategory,
} from "@/types/dashboard";
import { getSubscriptionPriceCategory } from "@/lib/subscription-filter-options";

/** Three list-price tiers per league × tariff (low / mid / high). */
export const SUBSCRIPTION_LIST_PRICES: Record<
  League,
  Partial<Record<SubscriptionPriceCategory, readonly [number, number, number]>>
> = {
  KHL: {
    all_inclusive: [55_000, 65_000, 75_000],
    weekend: [19_000, 21_000, 23_000],
    seasonal: [25_000, 35_000, 45_000],
  },
  VHL: {
    all_inclusive: [10_000, 12_000, 14_000],
    weekend: [5_000, 7_000, 9_000],
  },
  MHL: {
    all_inclusive: [5_000, 6_000, 7_000],
    weekend: [2_000, 3_000, 4_000],
  },
};

/** Catalog SKUs: KHL list prices. VHL/MHL override via SUBSCRIPTION_LIST_PRICES. */
export const subscriptionPlans: SubscriptionPlan[] = [
  {
    id: "plan-1",
    code: "SUB-5-A",
    name: "Абонемент на 5 матчей (сектор A)",
    matchCount: 5,
    price: 19_000,
  },
  {
    id: "plan-2",
    code: "SUB-5-B",
    name: "Абонемент на 5 матчей (сектор B)",
    matchCount: 5,
    price: 21_000,
  },
  {
    id: "plan-3",
    code: "SUB-10-A",
    name: "Абонемент на 10 матчей",
    matchCount: 10,
    price: 23_000,
  },
  {
    id: "plan-6",
    code: "SUB-STUD",
    name: "Студенческий абонемент",
    matchCount: 10,
    price: 25_000,
  },
  {
    id: "plan-4",
    code: "SUB-SEASON",
    name: "Сезонный абонемент",
    matchCount: 30,
    price: 35_000,
  },
  {
    id: "plan-9",
    code: "SUB-SEASON-PLUS",
    name: "Сезонный (премиум)",
    matchCount: 30,
    price: 45_000,
  },
  {
    id: "plan-7",
    code: "SUB-AI-B",
    name: "Все включено (сектор B)",
    matchCount: 30,
    price: 55_000,
  },
  {
    id: "plan-8",
    code: "SUB-AI-A",
    name: "Все включено (сектор A)",
    matchCount: 30,
    price: 65_000,
  },
  {
    id: "plan-5",
    code: "SUB-VIP",
    name: "Все включено (VIP)",
    matchCount: 30,
    price: 75_000,
  },
];

const PLAN_BY_ID = new Map(
  subscriptionPlans.map((plan) => [plan.id, plan] as const),
);

/** Low / mid / high SKUs for each tariff — same shape as the KHL weekend 3-plan spread. */
export const SUBSCRIPTION_TARIFF_TIER_PLAN_IDS: Record<
  SubscriptionPriceCategory,
  readonly [string, string, string]
> = {
  weekend: ["plan-1", "plan-2", "plan-3"],
  seasonal: ["plan-6", "plan-4", "plan-9"],
  all_inclusive: ["plan-7", "plan-8", "plan-5"],
};

export function getSubscriptionCatalogPlan(
  planId: string,
): SubscriptionPlan | undefined {
  return PLAN_BY_ID.get(planId);
}

export function getSubscriptionListPrices(
  league: League,
  tariff: SubscriptionPriceCategory,
): readonly [number, number, number] | undefined {
  return SUBSCRIPTION_LIST_PRICES[league][tariff];
}

export function getSubscriptionListPrice(
  league: League,
  planId: string,
): number {
  const plan = PLAN_BY_ID.get(planId);
  const tariff = getSubscriptionPriceCategory({
    planId,
    planName: plan?.name ?? "",
  });
  const prices =
    getSubscriptionListPrices(league, tariff) ??
    getSubscriptionListPrices(league, "weekend");
  if (!prices) return plan?.price ?? 0;

  const tierIds = SUBSCRIPTION_TARIFF_TIER_PLAN_IDS[tariff];
  const tier = Math.max(0, tierIds.indexOf(planId));
  return prices[tier] ?? prices[0];
}

function catalogTariffFor(
  sub: Pick<Subscription, "league" | "planId" | "planName">,
): SubscriptionPriceCategory {
  const tariff = getSubscriptionPriceCategory(sub);
  if (
    (sub.league === "VHL" || sub.league === "MHL") &&
    tariff === "seasonal"
  ) {
    return "weekend";
  }
  return tariff;
}

function compareSubscriptionIds(left: string, right: string): number {
  return left.localeCompare(right, undefined, { numeric: true });
}

/**
 * Assigns the three catalog tiers per league × season × tariff and writes
 * league-specific list prices. Rows are round-robined so a tariff that used
 * to have one SKU (e.g. plan-5) is split across low/mid/high instead of
 * landing on the middle price. Clones keep matchesUsed = 0.
 */
export function applyLeagueSubscriptionCatalogPrices(
  subs: Subscription[],
): void {
  const groups = new Map<string, Subscription[]>();

  for (const sub of subs) {
    const tariff = catalogTariffFor(sub);
    const key = `${sub.league}|${sub.season}|${tariff}`;
    const group = groups.get(key);
    if (group) group.push(sub);
    else groups.set(key, [sub]);
  }

  for (const [key, rows] of groups) {
    const [leagueId, , tariffId] = key.split("|");
    const league = leagueId as League;
    const tariff = tariffId as SubscriptionPriceCategory;
    const prices = getSubscriptionListPrices(league, tariff);
    const tierIds = SUBSCRIPTION_TARIFF_TIER_PLAN_IDS[tariff];
    if (!prices || !tierIds) continue;

    rows.sort((left, right) => compareSubscriptionIds(left.id, right.id));
    rows.forEach((sub, index) => {
      const tier = index % 3;
      const plan = PLAN_BY_ID.get(tierIds[tier]);
      if (!plan) return;
      sub.planId = plan.id;
      sub.planName = plan.name;
      sub.price = prices[tier];
      sub.matchesTotal = plan.matchCount;
      if (sub.matchesUsed > plan.matchCount) {
        sub.matchesUsed = plan.matchCount;
      }
    });
  }
}
