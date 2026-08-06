/**
 * Analyzes mock data coverage for all filter select options.
 * Usage: npx tsx scripts/analyze-filter-coverage.ts
 */

import {
  ALL_MERCH_PRODUCT_CATEGORIES,
  ALL_MERCH_SALES_POINTS,
  DEFAULT_MERCH_FILTERS,
} from "../lib/merch-filter-options";
import { DEFAULT_SUBSCRIPTION_FILTERS } from "../lib/subscription-filter-options";
import {
  ALL_PRICE_ZONES,
  DEFAULT_TICKET_FILTERS,
  SEASON_OPTIONS,
  LEAGUE_OPTIONS,
  TOURNAMENT_STAGE_OPTIONS,
  MATCH_CLASS_OPTIONS,
  ARENA_OPTIONS,
  EVENT_COMPLETED_OPTIONS,
  TICKET_TYPE_OPTIONS,
  PRICE_ZONE_OPTIONS,
  ORDER_SOURCE_OPTIONS,
} from "../lib/ticket-filter-options";
import { matches, transactions, subscriptions } from "../lib/mock/hockey";
import {
  filterMatchesByTicketFilters,
  filterMatchesByMerchFilters,
  filterTicketTransactions,
  filterMerchTransactions,
  filterSubscriptions,
  computeTicketsKpis,
  computeMerchKpis,
  computeSubscriptionsKpis,
  computePriceZoneSales,
  computeOrderSourceSales,
  computeMerchSalesChannelRevenue,
  computeMerchProductCategoryRevenue,
} from "../lib/filters";
import type {
  DashboardFilters,
  MerchFilters,
  SubscriptionFilters,
  TicketFilters,
} from "../types/dashboard";

const DEFAULT_DASHBOARD_FILTERS: DashboardFilters = {
  dateRange: 30,
  stream: "all",
  matchId: "all",
  promotionId: "all",
};

type CoverageRow = {
  filter: string;
  option: string;
  hasData: boolean;
  count: number;
  note: string;
};

function countUnique<T>(items: T[], getKey: (item: T) => string | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = getKey(item);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return map;
}

function analyzeTickets(): CoverageRow[] {
  const rows: CoverageRow[] = [];
  const ticketTxs = transactions.filter((tx) => tx.stream === "tickets");

  for (const opt of SEASON_OPTIONS) {
    const f: TicketFilters = { ...DEFAULT_TICKET_FILTERS, season: opt.value };
    const matchCount = filterMatchesByTicketFilters(f).length;
    const txCount = filterTicketTransactions(DEFAULT_DASHBOARD_FILTERS, f).length;
    const kpis = computeTicketsKpis(DEFAULT_DASHBOARD_FILTERS, f);
    rows.push({
      filter: "Сезон",
      option: opt.label,
      hasData: txCount > 0,
      count: txCount,
      note:
        matchCount === 0
          ? "Нет матчей"
          : kpis.revenue === 0
            ? "Матчи есть, транзакций нет"
            : `${matchCount} матчей, выручка ${kpis.revenue}`,
    });
  }

  for (const opt of LEAGUE_OPTIONS) {
    const f: TicketFilters = { ...DEFAULT_TICKET_FILTERS, league: opt.value };
    const txCount = filterTicketTransactions(DEFAULT_DASHBOARD_FILTERS, f).length;
    rows.push({
      filter: "Лига",
      option: opt.label,
      hasData: txCount > 0,
      count: txCount,
      note: `${filterMatchesByTicketFilters(f).length} матчей`,
    });
  }

  for (const opt of TOURNAMENT_STAGE_OPTIONS) {
    const f: TicketFilters = { ...DEFAULT_TICKET_FILTERS, tournamentStage: opt.value };
    const txCount = filterTicketTransactions(DEFAULT_DASHBOARD_FILTERS, f).length;
    rows.push({
      filter: "Этап турнира",
      option: opt.label,
      hasData: txCount > 0,
      count: txCount,
      note: `${filterMatchesByTicketFilters(f).length} матчей`,
    });
  }

  for (const opt of MATCH_CLASS_OPTIONS) {
    const f: TicketFilters = { ...DEFAULT_TICKET_FILTERS, matchClass: opt.value };
    const txCount = filterTicketTransactions(DEFAULT_DASHBOARD_FILTERS, f).length;
    rows.push({
      filter: "Класс матча",
      option: opt.label,
      hasData: txCount > 0,
      count: txCount,
      note: `${filterMatchesByTicketFilters(f).length} матчей`,
    });
  }

  for (const opt of ARENA_OPTIONS) {
    const f: TicketFilters = { ...DEFAULT_TICKET_FILTERS, arena: opt.value };
    const txCount = filterTicketTransactions(DEFAULT_DASHBOARD_FILTERS, f).length;
    rows.push({
      filter: "Арена",
      option: opt.label,
      hasData: txCount > 0,
      count: txCount,
      note: `${filterMatchesByTicketFilters(f).length} матчей`,
    });
  }

  for (const opt of EVENT_COMPLETED_OPTIONS) {
    const f: TicketFilters = {
      ...DEFAULT_TICKET_FILTERS,
      eventCompleted: opt.value,
    };
    const txCount = filterTicketTransactions(DEFAULT_DASHBOARD_FILTERS, f).length;
    const completed = filterMatchesByTicketFilters(f).filter((m) => m.eventCompleted).length;
    const upcoming = filterMatchesByTicketFilters(f).filter((m) => !m.eventCompleted).length;
    rows.push({
      filter: "Событие завершилось",
      option: opt.label,
      hasData: txCount > 0,
      count: txCount,
      note: `завершённых ${completed}, предстоящих ${upcoming}`,
    });
  }

  for (const opt of TICKET_TYPE_OPTIONS) {
    const f: TicketFilters = { ...DEFAULT_TICKET_FILTERS, ticketType: opt.value };
    const txCount = filterTicketTransactions(DEFAULT_DASHBOARD_FILTERS, f).length;
    const rawCount =
      opt.value === "all"
        ? ticketTxs.length
        : ticketTxs.filter((tx) => tx.ticketType === opt.value).length;
    rows.push({
      filter: "Тип билета",
      option: opt.label,
      hasData: txCount > 0,
      count: txCount,
      note: `сырых tx: ${rawCount}`,
    });
  }

  for (const opt of PRICE_ZONE_OPTIONS) {
    const f: TicketFilters = { ...DEFAULT_TICKET_FILTERS, priceZone: opt.value };
    const txCount = filterTicketTransactions(DEFAULT_DASHBOARD_FILTERS, f).length;
    const rawCount =
      opt.value === "all"
        ? ticketTxs.filter((tx) => tx.priceZone).length
        : ticketTxs.filter((tx) => tx.priceZone === opt.value).length;
    rows.push({
      filter: "Ценовая зона",
      option: opt.label,
      hasData: txCount > 0,
      count: txCount,
      note: `сырых tx: ${rawCount}`,
    });
  }

  for (const opt of ORDER_SOURCE_OPTIONS) {
    const f: TicketFilters = { ...DEFAULT_TICKET_FILTERS, orderSource: opt.value };
    const txCount = filterTicketTransactions(DEFAULT_DASHBOARD_FILTERS, f).length;
    const rawCount =
      opt.value === "all"
        ? ticketTxs.filter((tx) => tx.orderSource).length
        : ticketTxs.filter((tx) => tx.orderSource === opt.value).length;
    rows.push({
      filter: "Источник заказа",
      option: opt.label,
      hasData: txCount > 0,
      count: txCount,
      note: `сырых tx: ${rawCount}`,
    });
  }

  // Raw dimension coverage in mock data
  const zoneCounts = countUnique(
    ticketTxs.filter((tx) => tx.ticketType === "arena"),
    (tx) => tx.priceZone,
  );
  const missingZones = ALL_PRICE_ZONES.filter((z) => !zoneCounts.has(z));
  if (missingZones.length > 0) {
    rows.push({
      filter: "Ценовая зона (сырые данные)",
      option: missingZones.join(", "),
      hasData: false,
      count: 0,
      note: "Зоны без транзакций в mock",
    });
  }

  return rows;
}

function analyzeMerch(): CoverageRow[] {
  const rows: CoverageRow[] = [];
  const merchTxs = transactions.filter((tx) => tx.stream === "merch");

  for (const opt of SEASON_OPTIONS) {
    const f: MerchFilters = { ...DEFAULT_MERCH_FILTERS, season: opt.value };
    const txCount = filterMerchTransactions(DEFAULT_DASHBOARD_FILTERS, f, {
      useSeasonRange: true,
    }).length;
    const kpis = computeMerchKpis(DEFAULT_DASHBOARD_FILTERS, f);
    rows.push({
      filter: "Сезон",
      option: opt.label,
      hasData: kpis.revenue > 0,
      count: txCount,
      note: `выручка ${kpis.revenue}`,
    });
  }

  for (const opt of LEAGUE_OPTIONS) {
    const f: MerchFilters = { ...DEFAULT_MERCH_FILTERS, league: opt.value };
    const txCount = filterMerchTransactions(DEFAULT_DASHBOARD_FILTERS, f, {
      useSeasonRange: true,
    }).length;
    const kpis = computeMerchKpis(DEFAULT_DASHBOARD_FILTERS, f);
    rows.push({
      filter: "Лига",
      option: opt.label,
      hasData: kpis.revenue > 0,
      count: txCount,
      note: `выручка ${kpis.revenue}`,
    });
  }

  for (const opt of TOURNAMENT_STAGE_OPTIONS) {
    const f: MerchFilters = { ...DEFAULT_MERCH_FILTERS, tournamentStage: opt.value };
    const txCount = filterMerchTransactions(DEFAULT_DASHBOARD_FILTERS, f, {
      useSeasonRange: true,
    }).length;
    const kpis = computeMerchKpis(DEFAULT_DASHBOARD_FILTERS, f);
    rows.push({
      filter: "Этап турнира",
      option: opt.label,
      hasData: kpis.revenue > 0,
      count: txCount,
      note: `выручка ${kpis.revenue}`,
    });
  }

  for (const opt of MATCH_CLASS_OPTIONS) {
    const f: MerchFilters = { ...DEFAULT_MERCH_FILTERS, matchClass: opt.value };
    const txCount = filterMerchTransactions(DEFAULT_DASHBOARD_FILTERS, f, {
      useSeasonRange: true,
    }).length;
    const kpis = computeMerchKpis(DEFAULT_DASHBOARD_FILTERS, f);
    rows.push({
      filter: "Класс матча",
      option: opt.label,
      hasData: kpis.revenue > 0,
      count: txCount,
      note: `выручка ${kpis.revenue}`,
    });
  }

  for (const point of ALL_MERCH_SALES_POINTS) {
    const f: MerchFilters = { ...DEFAULT_MERCH_FILTERS, salesChannels: [point] };
    const txCount = filterMerchTransactions(DEFAULT_DASHBOARD_FILTERS, f, {
      useSeasonRange: true,
    }).length;
    const channelRev = computeMerchSalesChannelRevenue(
      DEFAULT_DASHBOARD_FILTERS,
      f,
    );
    const rawCount = merchTxs.filter((tx) => tx.merchSalesPoint === point).length;
    rows.push({
      filter: "Канал продаж",
      option: point,
      hasData: txCount > 0 && channelRev.some((c) => c.channelKey === point),
      count: txCount,
      note: `сырых tx: ${rawCount}`,
    });
  }

  const categoryCounts = countUnique(merchTxs, (tx) => tx.productCategory ?? undefined);
  for (const cat of ALL_MERCH_PRODUCT_CATEGORIES) {
    const rawCount = merchTxs.filter((tx) => tx.productCategory === cat).length;
    rows.push({
      filter: "Категория товара (виджеты)",
      option: cat,
      hasData: rawCount > 0,
      count: rawCount,
      note: categoryCounts.has(cat) ? "есть в данных" : "нет в данных",
    });
  }

  // Empty sales channels edge case
  const emptyChannels: MerchFilters = { ...DEFAULT_MERCH_FILTERS, salesChannels: [] };
  const emptyTx = filterMerchTransactions(
    DEFAULT_DASHBOARD_FILTERS,
    emptyChannels,
    { useSeasonRange: true },
  ).length;
  rows.push({
    filter: "Канал продаж",
    option: "(ничего не выбрано)",
    hasData: false,
    count: emptyTx,
    note: "Ожидаемо пусто — дизайн фильтра",
  });

  return rows;
}

function analyzeSubscriptions(): CoverageRow[] {
  const rows: CoverageRow[] = [];

  for (const opt of SEASON_OPTIONS) {
    const f: SubscriptionFilters = { ...DEFAULT_SUBSCRIPTION_FILTERS, season: opt.value };
    const subs = filterSubscriptions(DEFAULT_DASHBOARD_FILTERS, f);
    const kpis = computeSubscriptionsKpis(DEFAULT_DASHBOARD_FILTERS, f);
    rows.push({
      filter: "Сезон",
      option: opt.label,
      hasData: subs.length > 0,
      count: subs.length,
      note: `выручка ${kpis.revenue}`,
    });
  }

  for (const opt of LEAGUE_OPTIONS) {
    const f: SubscriptionFilters = { ...DEFAULT_SUBSCRIPTION_FILTERS, league: opt.value };
    const subs = filterSubscriptions(DEFAULT_DASHBOARD_FILTERS, f);
    rows.push({
      filter: "Лига",
      option: opt.label,
      hasData: subs.length > 0,
      count: subs.length,
      note: "",
    });
  }

  for (const opt of TOURNAMENT_STAGE_OPTIONS) {
    const f: SubscriptionFilters = {
      ...DEFAULT_SUBSCRIPTION_FILTERS,
      tournamentStage: opt.value,
    };
    const subs = filterSubscriptions(DEFAULT_DASHBOARD_FILTERS, f);
    rows.push({
      filter: "Этап турнира",
      option: opt.label,
      hasData: subs.length > 0,
      count: subs.length,
      note: "",
    });
  }

  for (const opt of ARENA_OPTIONS) {
    const f: SubscriptionFilters = { ...DEFAULT_SUBSCRIPTION_FILTERS, arena: opt.value };
    const subs = filterSubscriptions(DEFAULT_DASHBOARD_FILTERS, f);
    rows.push({
      filter: "Арена",
      option: opt.label,
      hasData: subs.length > 0,
      count: subs.length,
      note: "",
    });
  }

  for (const opt of TICKET_TYPE_OPTIONS) {
    const f: SubscriptionFilters = { ...DEFAULT_SUBSCRIPTION_FILTERS, ticketType: opt.value };
    const subs = filterSubscriptions(DEFAULT_DASHBOARD_FILTERS, f);
    rows.push({
      filter: "Тип билета",
      option: opt.label,
      hasData: subs.length > 0,
      count: subs.length,
      note: `сырых: ${opt.value === "all" ? subscriptions.length : subscriptions.filter((s) => s.ticketType === opt.value).length}`,
    });
  }

  for (const opt of PRICE_ZONE_OPTIONS) {
    const f: SubscriptionFilters = { ...DEFAULT_SUBSCRIPTION_FILTERS, priceZone: opt.value };
    const subs = filterSubscriptions(DEFAULT_DASHBOARD_FILTERS, f);
    const rawCount =
      opt.value === "all"
        ? subscriptions.length
        : subscriptions.filter((s) => s.priceZone === opt.value).length;
    rows.push({
      filter: "Ценовая зона",
      option: opt.label,
      hasData: subs.length > 0,
      count: subs.length,
      note: `сырых: ${rawCount}`,
    });
  }

  const zoneCounts = countUnique(subscriptions, (s) => s.priceZone);
  const missingZones = ALL_PRICE_ZONES.filter((z) => !zoneCounts.has(z));
  if (missingZones.length > 0) {
    rows.push({
      filter: "Ценовая зона (сырые данные)",
      option: missingZones.join(", "),
      hasData: false,
      count: 0,
      note: "Зоны без абонементов",
    });
  }

  return rows;
}

function printSection(title: string, rows: CoverageRow[]) {
  console.log(`\n=== ${title} ===\n`);
  console.log("| Фильтр | Опции | Есть данные? | Примечание |");
  console.log("|--------|-------|--------------|------------|");
  for (const row of rows) {
    const has = row.hasData ? "Да" : "Нет";
    console.log(`| ${row.filter} | ${row.option} | ${has} (${row.count}) | ${row.note} |`);
  }
  const gaps = rows.filter((r) => !r.hasData && !r.note.includes("Ожидаемо"));
  if (gaps.length > 0) {
    console.log(`\nПробелы (${gaps.length}):`);
    for (const g of gaps) {
      console.log(`  - ${g.filter} / ${g.option}`);
    }
  } else {
    console.log("\nКритических пробелов не обнаружено.");
  }
}

console.log("Mock summary:");
console.log(`  Matches: ${matches.length}`);
console.log(`  Transactions: ${transactions.length} (tickets: ${transactions.filter((t) => t.stream === "tickets").length}, merch: ${transactions.filter((t) => t.stream === "merch").length})`);
console.log(`  Subscriptions: ${subscriptions.length}`);

// Raw match dimension counts
const matchDims = {
  seasons: countUnique(matches, (m) => m.season),
  leagues: countUnique(matches, (m) => m.league),
  stages: countUnique(matches, (m) => m.tournamentStage),
  classes: countUnique(matches, (m) => m.matchClass),
  arenas: countUnique(matches, (m) => m.arena),
  completed: {
    yes: matches.filter((m) => m.eventCompleted).length,
    no: matches.filter((m) => !m.eventCompleted).length,
  },
};
console.log("\nRaw match dimensions:", Object.fromEntries(
  Object.entries(matchDims).map(([k, v]) => [k, v instanceof Map ? Object.fromEntries(v) : v]),
));

printSection("Билеты (Tickets)", analyzeTickets());
printSection("Мерч (Merch)", analyzeMerch());
printSection("Абонементы (Subscriptions)", analyzeSubscriptions());

// Critical combos
console.log("\n=== Критические комбинации ===\n");
const combos: { name: string; tab: "tickets" | "merch" | "subs"; check: () => boolean }[] = [
  {
    name: "Билеты: KHL + плей-офф + class_1",
    tab: "tickets",
    check: () =>
      filterTicketTransactions(DEFAULT_DASHBOARD_FILTERS, {
        ...DEFAULT_TICKET_FILTERS,
        league: "KHL",
        tournamentStage: "playoff",
        matchClass: "playoff",
      }).length > 0,
  },
  {
    name: "Билеты: VHL + второстепенная арена",
    tab: "tickets",
    check: () =>
      filterTicketTransactions(DEFAULT_DASHBOARD_FILTERS, {
        ...DEFAULT_TICKET_FILTERS,
        league: "VHL",
        arena: "secondary",
      }).length > 0,
  },
  {
    name: "Билеты: 2024/25 + не завершено",
    tab: "tickets",
    check: () =>
      filterTicketTransactions(DEFAULT_DASHBOARD_FILTERS, {
        ...DEFAULT_TICKET_FILTERS,
        season: "2024/25",
        eventCompleted: "no",
      }).length > 0,
  },
  {
    name: "Мерч: MHL + mall_raduga",
    tab: "merch",
    check: () =>
      filterMerchTransactions(
        DEFAULT_DASHBOARD_FILTERS,
        {
          ...DEFAULT_MERCH_FILTERS,
          league: "MHL",
          salesChannels: ["mall_raduga"],
        },
        { useSeasonRange: true },
      ).length > 0,
  },
  {
    name: "Мерч: плей-офф + class_3",
    tab: "merch",
    check: () =>
      computeMerchKpis(DEFAULT_DASHBOARD_FILTERS, {
        ...DEFAULT_MERCH_FILTERS,
        tournamentStage: "playoff",
        matchClass: "class_3",
      }).revenue > 0,
  },
  {
    name: "Абонементы: 2024/25 + VHL + parking",
    tab: "subs",
    check: () =>
      filterSubscriptions(DEFAULT_DASHBOARD_FILTERS, {
        ...DEFAULT_SUBSCRIPTION_FILTERS,
        season: "2024/25",
        league: "VHL",
        ticketType: "parking",
      }).length > 0,
  },
  {
    name: "Абонементы: playoff + VIP zone",
    tab: "subs",
    check: () =>
      filterSubscriptions(DEFAULT_DASHBOARD_FILTERS, {
        ...DEFAULT_SUBSCRIPTION_FILTERS,
        tournamentStage: "playoff",
        priceZone: "VIP",
      }).length > 0,
  },
];

for (const c of combos) {
  const ok = c.check();
  console.log(`${ok ? "OK" : "GAP"}: ${c.name}`);
}
