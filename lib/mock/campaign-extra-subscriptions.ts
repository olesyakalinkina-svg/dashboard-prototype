import { addDays } from "date-fns";
import type { Sector, Subscription } from "@/types/dashboard";
import {
  getCampaignStatus,
  getSeasonTicketCampaignConfigs,
} from "@/lib/subscription-campaign/campaigns";
import {
  getCampaignDayNumber,
  parseCalendarDate,
} from "@/lib/subscription-campaign/dates";
import { MOCK_TODAY } from "@/lib/mock/constants";
import {
  getSubscriptionListPrice,
  subscriptionPlans,
} from "@/lib/mock/subscription-catalog";

const PLAN_ZONES: Record<string, Sector> = {
  "plan-1": "A",
  "plan-2": "B1",
  "plan-3": "A",
  "plan-4": "A",
  "plan-5": "VIP",
  "plan-6": "B1",
  "plan-7": "B1",
  "plan-8": "A",
  "plan-9": "A",
};

const PLANS = subscriptionPlans.map((plan) => ({
  id: plan.id,
  name: plan.name,
  matchCount: plan.matchCount,
  price: getSubscriptionListPrice("KHL", plan.id),
  zone: PLAN_ZONES[plan.id] ?? ("A" as Sector),
}));

/**
 * Demo sales for the active spring campaign. Kept out of hockey-mock.json so
 * ticket/merch transactions stay untouched. Merged in the data store.
 */
export function getActiveCampaignPaceSubscriptions(
  dataAsOfDate: Date = MOCK_TODAY,
): Subscription[] {
  const campaign = getSeasonTicketCampaignConfigs().find(
    (item) => getCampaignStatus(item, dataAsOfDate) === "active",
  );
  if (!campaign) return [];

  const elapsed = getCampaignDayNumber(dataAsOfDate, campaign.startDate);
  if (elapsed < 1) return [];

  const emptyDays = new Set<number>([1, 2]);
  if (elapsed >= 8) emptyDays.add(8);
  const sellable: number[] = [];
  for (let day = 1; day <= elapsed; day += 1) {
    if (!emptyDays.has(day)) sellable.push(day);
  }
  if (sellable.length === 0) return [];

  const start = parseCalendarDate(campaign.startDate);
  const count = 48;
  const created: Subscription[] = [];

  for (let index = 0; index < count; index += 1) {
    const t = count <= 1 ? 0 : index / (count - 1);
    const biased = Math.pow(t, 1.35);
    const dayIndex = Math.min(
      sellable.length - 1,
      Math.floor(biased * sellable.length),
    );
    const purchasedAt = addDays(start, sellable[dayIndex] - 1);
    const plan = PLANS[index % PLANS.length];
    created.push({
      id: `sub-cpace-${index + 1}`,
      planId: plan.id,
      planName: plan.name,
      customerId: `cust-cpace-${Math.floor((index * 4) / 5) + 1}`,
      purchasedAt,
      validTo: addDays(purchasedAt, 90),
      price: plan.price,
      matchesTotal: plan.matchCount,
      matchesUsed: Math.min(2, plan.matchCount),
      channel: index % 3 === 0 ? "box_office" : "official_site",
      status: "active",
      season: campaign.seasonId,
      league: "KHL",
      tournamentStage: "regular",
      arena: "main",
      ticketType: "arena",
      sector: plan.zone,
    });
  }

  if (created.length >= 4) {
    created[1].customerId = created[0].customerId;
    created[1].purchasedAt = created[0].purchasedAt;
    created[1].validTo = created[0].validTo;
  }

  return created;
}

export function mergeActiveCampaignPaceSubscriptions(
  subscriptions: Subscription[],
): Subscription[] {
  if (subscriptions.some((sub) => sub.id.startsWith("sub-cpace-"))) {
    return subscriptions;
  }
  const extras = getActiveCampaignPaceSubscriptions();
  if (extras.length === 0) return subscriptions;
  if (subscriptions.some((sub) => sub.season === extras[0].season)) {
    return subscriptions;
  }
  return subscriptions.concat(extras);
}
