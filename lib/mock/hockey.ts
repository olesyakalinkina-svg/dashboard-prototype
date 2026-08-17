import { addDays, subDays } from "date-fns";
import type { Promotion, SubscriptionPlan } from "@/types/dashboard";
import {
  getPromotionMatchDate,
  MOCK_TODAY,
  PREV_SEASON_END,
  PREV_SEASON_START,
  SEASON_END,
  SEASON_START,
  SUBSCRIPTIONS_PERIOD_END,
  SUBSCRIPTIONS_PERIOD_START,
} from "@/lib/mock/constants";
import { getMatchById } from "@/lib/mock/data-store";

export {
  MOCK_TODAY,
  PREV_SEASON_END,
  PREV_SEASON_START,
  SEASON_END,
  SEASON_START,
  SUBSCRIPTIONS_PERIOD_END,
  SUBSCRIPTIONS_PERIOD_START,
} from "@/lib/mock/constants";
export {
  getMatchById,
  getMatches,
  getMerchTransactions,
  getSubscriptionRedemptions,
  getSubscriptions,
  getTicketTransactionsByMatchId,
  getTransactions,
  initMockDataSync,
  isMockDataReady,
  loadMockData,
} from "@/lib/mock/data-store";

export {
  getFirstPlayoffMatchDate,
  getPlayoffSubscriptionSalesWindow,
  getPlayoffWindowStart,
} from "@/lib/mock/hockey-generator";

export const promotions: Promotion[] = [
  {
    id: "promo-1",
    name: "Семейный матч −20%",
    startDate: subDays(getPromotionMatchDate(0), 18),
    endDate: addDays(getPromotionMatchDate(1), 1),
    matchIds: ["match-1", "match-2"],
    reach: 45000,
    conversions: 820,
    revenueLift: 1250000,
    targetStream: "tickets",
  },
  {
    id: "promo-2",
    name: "Первый гол — скидка на мерч",
    startDate: subDays(getPromotionMatchDate(2), 14),
    endDate: addDays(getPromotionMatchDate(4), 2),
    matchIds: ["match-3", "match-4", "match-5"],
    reach: 62000,
    conversions: 1340,
    revenueLift: 890000,
    targetStream: "merch",
  },
  {
    id: "promo-3",
    name: "День болельщика",
    startDate: subDays(getPromotionMatchDate(5), 10),
    endDate: addDays(getPromotionMatchDate(6), 1),
    matchIds: ["match-6", "match-7"],
    reach: 38000,
    conversions: 2100,
    revenueLift: 560000,
    targetStream: "all",
  },
  {
    id: "promo-4",
    name: "Спонсор X2 баллы",
    startDate: subDays(getPromotionMatchDate(7), 12),
    endDate: addDays(getPromotionMatchDate(9), 1),
    matchIds: ["match-8", "match-9", "match-10"],
    reach: 71000,
    conversions: 980,
    revenueLift: 720000,
    targetStream: "merch",
  },
  {
    id: "promo-6",
    name: "VIP-ложа: гость бесплатно",
    startDate: subDays(getPromotionMatchDate(10), 7),
    endDate: addDays(getPromotionMatchDate(11), 1),
    matchIds: ["match-11", "match-12"],
    reach: 12000,
    conversions: 145,
    revenueLift: 2100000,
    targetStream: "tickets",
  },
  {
    id: "promo-7",
    name: "Новогодний хоккейный вечер",
    startDate: subDays(getPromotionMatchDate(12), 10),
    endDate: addDays(getPromotionMatchDate(13), 1),
    matchIds: ["match-13", "match-14"],
    reach: 55000,
    conversions: 1680,
    revenueLift: 980000,
    targetStream: "all",
  },
  {
    id: "promo-8",
    name: "Студенческий билет −30%",
    startDate: subDays(getPromotionMatchDate(13), 14),
    endDate: MOCK_TODAY,
    matchIds: ["match-14", "match-15"],
    reach: 33000,
    conversions: 890,
    revenueLift: 420000,
    targetStream: "tickets",
  },
];

export function getMatchLabel(matchId: string): string {
  const match = getMatchById().get(matchId);
  if (!match) return "—";
  return `vs ${match.opponent}`;
}

export const subscriptionPlans: SubscriptionPlan[] = [
  { id: "plan-1", code: "SUB-5-A", name: "Абонемент на 5 матчей (сектор A)", matchCount: 5, price: 6500 },
  { id: "plan-2", code: "SUB-5-B", name: "Абонемент на 5 матчей (сектор B)", matchCount: 5, price: 4875 },
  { id: "plan-3", code: "SUB-10-A", name: "Абонемент на 10 матчей", matchCount: 10, price: 11700 },
  { id: "plan-4", code: "SUB-SEASON", name: "Сезонный абонемент", matchCount: 30, price: 55250 },
  { id: "plan-5", code: "SUB-VIP", name: "VIP-сезонный абонемент", matchCount: 30, price: 162500 },
  { id: "plan-6", code: "SUB-STUD", name: "Студенческий абонемент", matchCount: 10, price: 3900 },
];
