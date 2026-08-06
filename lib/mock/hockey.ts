import { addDays, differenceInCalendarDays, startOfDay, subDays } from "date-fns";
import type { Match, Promotion, SubscriptionPlan } from "@/types/dashboard";
import mockData from "@/lib/mock/data/hockey-mock.json";
import { reviveMockData, type RawMockData } from "@/lib/mock/revive-dates";

const KHL_MATCH_COUNT = 15;

export const PREV_SEASON_START = new Date(2024, 8, 1);
export const PREV_SEASON_END = new Date(2025, 4, 31);
export const SEASON_START = new Date(2025, 8, 1);
export const SEASON_END = new Date(2026, 4, 31);
export const MOCK_TODAY = new Date(2026, 4, 15);
export const SUBSCRIPTIONS_PERIOD_START = new Date(2025, 7, 25);
export const SUBSCRIPTIONS_PERIOD_END = new Date(2025, 8, 14);

export {
  getFirstPlayoffMatchDate,
  getPlayoffSubscriptionSalesWindow,
  getPlayoffWindowStart,
} from "@/lib/mock/hockey-generator";

function getMatchDate(
  index: number,
  matchCount: number,
  seasonStart: Date,
  seasonEnd: Date,
): Date {
  const seasonSpanDays = differenceInCalendarDays(seasonEnd, seasonStart);
  if (matchCount <= 1) return startOfDay(seasonStart);
  const offset = Math.round((index / (matchCount - 1)) * seasonSpanDays);
  return startOfDay(addDays(seasonStart, offset));
}

function getCurrentSeasonMatchDate(index: number): Date {
  return getMatchDate(index, KHL_MATCH_COUNT, SEASON_START, SEASON_END);
}

const { matches, transactions, subscriptions } = reviveMockData(
  mockData as RawMockData,
);

export { matches, transactions, subscriptions };

export const promotions: Promotion[] = [
  {
    id: "promo-1",
    name: "Семейный матч −20%",
    startDate: subDays(getCurrentSeasonMatchDate(0), 18),
    endDate: addDays(getCurrentSeasonMatchDate(1), 1),
    matchIds: ["match-1", "match-2"],
    reach: 45000,
    conversions: 820,
    revenueLift: 1250000,
    targetStream: "tickets",
  },
  {
    id: "promo-2",
    name: "Первый гол — скидка на мерч",
    startDate: subDays(getCurrentSeasonMatchDate(2), 14),
    endDate: addDays(getCurrentSeasonMatchDate(4), 2),
    matchIds: ["match-3", "match-4", "match-5"],
    reach: 62000,
    conversions: 1340,
    revenueLift: 890000,
    targetStream: "merch",
  },
  {
    id: "promo-3",
    name: "День болельщика",
    startDate: subDays(getCurrentSeasonMatchDate(5), 10),
    endDate: addDays(getCurrentSeasonMatchDate(6), 1),
    matchIds: ["match-6", "match-7"],
    reach: 38000,
    conversions: 2100,
    revenueLift: 560000,
    targetStream: "all",
  },
  {
    id: "promo-4",
    name: "Спонсор X2 баллы",
    startDate: subDays(getCurrentSeasonMatchDate(7), 12),
    endDate: addDays(getCurrentSeasonMatchDate(9), 1),
    matchIds: ["match-8", "match-9", "match-10"],
    reach: 71000,
    conversions: 980,
    revenueLift: 720000,
    targetStream: "merch",
  },
  {
    id: "promo-6",
    name: "VIP-ложа: гость бесплатно",
    startDate: subDays(getCurrentSeasonMatchDate(10), 7),
    endDate: addDays(getCurrentSeasonMatchDate(11), 1),
    matchIds: ["match-11", "match-12"],
    reach: 12000,
    conversions: 145,
    revenueLift: 2100000,
    targetStream: "tickets",
  },
  {
    id: "promo-7",
    name: "Новогодний хоккейный вечер",
    startDate: subDays(getCurrentSeasonMatchDate(12), 10),
    endDate: addDays(getCurrentSeasonMatchDate(13), 1),
    matchIds: ["match-13", "match-14"],
    reach: 55000,
    conversions: 1680,
    revenueLift: 980000,
    targetStream: "all",
  },
  {
    id: "promo-8",
    name: "Студенческий билет −30%",
    startDate: subDays(getCurrentSeasonMatchDate(13), 14),
    endDate: MOCK_TODAY,
    matchIds: ["match-14", "match-15"],
    reach: 33000,
    conversions: 890,
    revenueLift: 420000,
    targetStream: "tickets",
  },
];

export function getMatchLabel(matchId: string): string {
  const match = matches.find((m) => m.id === matchId);
  if (!match) return "—";
  return `vs ${match.opponent}`;
}

export const subscriptionPlans: SubscriptionPlan[] = [
  { id: "plan-1", code: "SUB-5-A", name: "Абонемент на 5 матчей (сектор A)", matchCount: 5, price: 10000 },
  { id: "plan-2", code: "SUB-5-B", name: "Абонемент на 5 матчей (сектор B)", matchCount: 5, price: 7500 },
  { id: "plan-3", code: "SUB-10-A", name: "Абонемент на 10 матчей", matchCount: 10, price: 18000 },
  { id: "plan-4", code: "SUB-SEASON", name: "Сезонный абонемент", matchCount: 30, price: 85000 },
  { id: "plan-5", code: "SUB-VIP", name: "VIP-сезонный абонемент", matchCount: 30, price: 250000 },
  { id: "plan-6", code: "SUB-STUD", name: "Студенческий абонемент", matchCount: 10, price: 6000 },
];

export const matchById = new Map<string, Match>(matches.map((m) => [m.id, m]));
