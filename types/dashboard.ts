export type RevenueStream = "tickets" | "merch";

export type SalesChannel = "online" | "arena" | "kiosk";

export type SubscriptionSalesChannel = "box_office" | "official_site";

export type MerchSalesPoint =
  | "flagship"
  | "arena_north"
  | "arena_south"
  | "mall_raduga"
  | "mall_continent"
  | "online_store";

export type MerchSalesGroup = "arena" | "trk" | "online";

export type MerchProductCategory =
  | "jerseys"
  | "souvenirs"
  | "drinkware"
  | "apparel"
  | "accessories";

export type League = "KHL" | "VHL" | "MHL";
export type TournamentStage = "regular" | "playoff";
export type MatchClass = "class_1" | "class_2" | "class_3" | "playoff";
export type ArenaId = "main" | "secondary";
export type TicketType = "parking" | "arena";
export type Sector =
  | "A"
  | "B1"
  | "B2"
  | "B3"
  | "B4"
  | "C1"
  | "C2"
  | "C3"
  | "C4"
  | "D1"
  | "D2"
  | "D3"
  | "D4"
  | "VIP";

/** Seat inventory for the 14 arena sectors. Shared by matches at the same venue. */
export type SectorCapacityMap = Record<Sector, number>;
/** Ticket unit-price buckets. Tickets at or above 6000 stay in the last bucket. */
export type PriceZone =
  | "up_to_1500"
  | "from_1500_to_2500"
  | "from_2500_to_4000"
  | "from_4000_to_6000";
export type OrderSource = "box_office" | "official_site" | "yandex_afisha";
export type TimeGrouping = "day" | "week" | "month" | "quarter";

export type Transaction = {
  id: string;
  date: Date;
  stream: RevenueStream;
  description: string;
  matchId: string | null;
  channel: SalesChannel;
  amount: number;
  quantity: number;
  loyaltyDiscount?: number;
  freeQuantity?: number;
  sector?: Sector;
  ticketType?: TicketType;
  priceZone?: PriceZone;
  orderSource?: OrderSource;
  merchSalesPoint?: MerchSalesPoint;
  productCategory?: MerchProductCategory;
  /** Recommended unit price before discounts (merch). */
  listUnitPrice?: number;
  isReturn?: boolean;
  costAmount?: number;
};

export type MatchSalesRow = {
  matchId: string;
  eventLabel: string;
  date: Date;
  revenue: number;
  planRevenue: number;
  avgPrice: number;
  ticketsSold: number;
  freeTickets: number;
  issuedTickets: number;
  /**
   * Arena issued tickets for occupancy % (parking excluded).
   * `issuedTickets` still includes parking quantity.
   */
  occupancyIssuedTickets: number;
  capacity: number;
  loyaltyDiscountPct: number;
};

export type MerchMatchSalesRow = {
  matchId: string;
  eventLabel: string;
  date: Date;
  revenue: number;
  /** Match-level merch sales plan (`getMatchMerchPlanRevenue` or explicit match-id target); 0 when missing. */
  planRevenue: number;
  avgCheck: number;
  receipts: number;
  units: number;
  upt: number;
  attendance: number;
  purchaseConversionPct: number;
};

export type MerchSkuSalesRow = {
  productName: string;
  units: number;
  revenue: number;
  receiptsWithProduct: number;
  marginPct: number;
  /** Average actual unit price vs recommended list price, %. */
  actualToListPricePct: number;
};

export type TicketSalesTempo =
  | "steady"
  | "front_loaded"
  | "back_loaded"
  | "slow_start";

export type TicketSalesProfile = {
  fulfillmentFactor?: number;
  tempo?: TicketSalesTempo;
};

export type Match = {
  id: string;
  date: Date;
  opponent: string;
  attendance: number;
  capacity: number;
  season: string;
  league: League;
  tournamentStage: TournamentStage;
  matchClass: MatchClass;
  /**
   * Home-calendar series label (e.g. «Сентябрь», «Февраль-Март», «ПО. Ак Барс»).
   * Regular-season KHL 2025/26 uses the club calendar; playoffs use round names.
   */
  series?: string;
  arena: ArenaId;
  eventCompleted: boolean;
  /** Days before match when ticket sales open (10–16). */
  ticketSalesWindowDays: number;
  /** Optional overrides for chart demo scenarios in mock data. */
  ticketSalesProfile?: TicketSalesProfile;
  /**
   * Raised ticket-count plan when realized paid+parking sales would exceed
   * 105% of the formula plan. Used by KPIs and match tables.
   */
  ticketPlanTickets?: number;
  /**
   * Raised revenue plan when realized ticket revenue would exceed 105% of
   * the formula plan (capacity × fill × avg price + parking).
   */
  ticketPlanRevenue?: number;
  /**
   * Raised merch revenue plan when realized match-table merch would exceed
   * 103% of the formula plan (or 100% when the ticket revenue plan is met).
   * Explicit `MERCH_PLAN_FULFILLMENT_BY_MATCH_ID` rows set this to
   * `round(actual / target)` instead of those bands.
   */
  merchPlanRevenue?: number;
};

export type Promotion = {
  id: string;
  name: string;
  startDate: Date;
  endDate: Date;
  matchIds: string[];
  reach: number;
  conversions: number;
  revenueLift: number;
  targetStream: RevenueStream | "all";
};

export type DateRangePreset = 7 | 30 | 90;

export type DashboardFilters = {
  dateRange: DateRangePreset;
  stream: RevenueStream | "all";
  matchId: string | "all";
  promotionId: string | "all";
};

/** ISO date (yyyy-MM-dd) range for transaction date filtering */
export type MerchOrderDateRange = {
  from: string | null;
  to: string | null;
};

export type TicketFilters = {
  season: string | "all";
  league: League | "all";
  tournamentStage: TournamentStage | "all";
  matchClass: MatchClass | "all";
  /** Home-calendar series label, or all series. */
  series: string | "all";
  arena: ArenaId | "all";
  eventCompleted: "all" | "yes" | "no";
  matchId: string[];
  ticketType: TicketType | "all";
  priceZone: PriceZone | "all";
  /** Empty / all selected = no restriction. `__no_sectors__` = explicit none. */
  sector: string[];
  orderSource: OrderSource | "all";
  /** Purchase date window for ticket transactions (within season window) */
  transactionDateRange: MerchOrderDateRange;
  timeGrouping: TimeGrouping;
};

export type MerchFilters = {
  season: string | "all";
  league: League | "all";
  tournamentStage: TournamentStage | "all";
  matchClass: MatchClass | "all";
  /** Home-calendar series label, or all series. */
  series: string | "all";
  matchId: string[];
  salesChannels: MerchSalesPoint[];
  productCategories: MerchProductCategory[];
  /** Order date window for merch transactions (all sales channels) */
  orderDateRange: MerchOrderDateRange;
  timeGrouping: TimeGrouping;
};

export type SubscriptionFilters = {
  season: string | "all";
  league: League | "all";
  tournamentStage: TournamentStage | "all";
  arena: ArenaId | "all";
  priceCategory: SubscriptionPriceCategory | "all";
  timeGrouping: TimeGrouping;
};

export type MatchSalesFilters = {
  season: string | "all";
  league: League | "all";
  tournamentStage: TournamentStage | "all";
  matchClass: MatchClass | "all";
  /** Home-calendar series label, or all series. */
  series: string | "all";
  arena: ArenaId | "all";
  eventCompleted: "all" | "yes" | "no";
  matchId: string[];
  /** Shared purchase date window for ticket and merch transactions */
  purchaseDateRange: MerchOrderDateRange;
};

export type CombinedMatchSalesRow = {
  matchId: string;
  eventLabel: string;
  date: Date;
  ticketRevenue: number;
  merchRevenue: number;
  totalRevenue: number;
  planRevenue: number;
  ticketsSold: number;
  issuedTickets: number;
  capacity: number;
  fillRate: number;
  merchReceipts: number;
};

export type MatchSalesSeasonComparison = {
  previousSeason: string;
  totalRevenueChange: number;
  ticketRevenueChange: number;
  merchRevenueChange: number;
  ticketsSoldChange: number;
  fillRateChange: number;
  matchCountChange: number;
};

export type MatchSalesKpiData = {
  totalRevenue: number;
  ticketRevenue: number;
  merchRevenue: number;
  ticketsSold: number;
  fillRate: number;
  matchCount: number;
  seasonComparison?: MatchSalesSeasonComparison;
};

export type DashboardTab = "subscriptions" | "tickets" | "merch" | "matches";

export type SubscriptionStatus = "active" | "expired" | "fully_used" | "cancelled";

export type SeasonTicketCampaignStatus = "upcoming" | "active" | "completed";

export type SeasonTicketCampaign = {
  id: string;
  seasonId: string;
  seasonName: string;
  startDate: string;
  endDate: string | null;
  status: SeasonTicketCampaignStatus;
};

export type SubscriptionPlan = {
  id: string;
  code: string;
  name: string;
  matchCount: number;
  price: number;
};

export type Subscription = {
  id: string;
  planId: string;
  planName: string;
  customerId: string;
  purchasedAt: Date;
  validTo: Date;
  price: number;
  matchesTotal: number;
  matchesUsed: number;
  channel: SubscriptionSalesChannel;
  status: SubscriptionStatus;
  season: string;
  league: League;
  tournamentStage: TournamentStage;
  arena: ArenaId;
  ticketType: TicketType;
  sector: Sector;
};

/** One abonement use at a home match (does not carry subscription purchase revenue). */
export type SubscriptionRedemption = {
  id: string;
  subscriptionId: string;
  matchId: string;
  redeemedAt: Date;
};

export type SubscriptionPriceCategory =
  | "all_inclusive"
  | "weekend"
  | "seasonal";

export type SubscriptionPlanStat = {
  plan: string;
  sold: number;
  revenue: number;
  utilization: number;
};

export type SubscriptionPriceCategoryPoint = {
  category: string;
  categoryKey: SubscriptionPriceCategory;
  sold: number;
  share: number;
};

export type WeeklyPoint = {
  period: string;
  value: number;
};

export type PlanFactTrendPoint = {
  period: string;
  sortKey: number;
  planRevenue: number;
  factRevenue: number;
  planTickets: number;
  factTickets: number;
};

export type SubscriptionsPlanFactTrendPoint = PlanFactTrendPoint & {
  regularFactRevenue: number;
  playoffFactRevenue: number;
};

export type TicketMatchCumulativePoint = {
  date: string;
  dateKey: number;
  daysBeforeMatch: number;
  revenue: number | null;
  tickets: number | null;
  planRevenue: number;
  planTickets: number;
};

export type TicketMatchCumulativeSeriesRole = "selected" | "comparison";

export type TicketMatchCumulativeSeries = {
  matchId: string;
  label: string;
  color: string;
  league: League;
  season: string;
  matchClass: MatchClass;
  matchDateKey: number;
  eventCompleted: boolean;
  hasFactSales: boolean;
  planRevenue: number;
  planTickets: number;
  currentDaysBeforeMatch: number | null;
  points: TicketMatchCumulativePoint[];
  seriesRole?: TicketMatchCumulativeSeriesRole;
};

export type TicketsSeasonMatchStatus = "behind" | "on_track" | "ahead";

export type TicketsSeasonMatchSeriesView = {
  matchId: string;
  opponent: string;
  matchDate: string;
  matchDateKey: number;
  legendLabel: string;
  color: string;
  league: League;
  season: string;
  matchClass: MatchClass;
  planRevenue: number;
  eventCompleted: boolean;
  hasFactSales: boolean;
  isOnSale: boolean;
  salesStartDateKey: number;
  currentFact: number;
  completionPct: number;
  deviationPct: number;
  status: TicketsSeasonMatchStatus;
  isSelected?: boolean;
  isComparison?: boolean;
};

export type TicketsSeasonMatchChartRow = {
  dateKey: number;
  periodLabel: string;
  [seriesKey: string]: string | number | null;
};

export type TopProductPoint = {
  name: string;
  revenue: number;
  units: number;
};

export type ChannelMixPoint = {
  channel: string;
  value: number;
};

export type MerchSalesChannelPoint = {
  channel: string;
  channelKey: MerchSalesPoint;
  value: number;
  share: number;
};

export type MerchSalesChannelTrendPoint = {
  period: string;
  sortKey: number;
  channels: Record<MerchSalesPoint, number>;
};

export type TicketsSalesChannelTrendPoint = {
  period: string;
  sortKey: number;
  channels: Record<OrderSource, number>;
};

export type MerchProductCategoryPoint = {
  category: string;
  categoryKey: MerchProductCategory;
  value: number;
  units: number;
  share: number;
};

export type MerchProductCategoryTrendPoint = {
  period: string;
  sortKey: number;
  categories: Record<MerchProductCategory, number>;
};

export type TicketsSeasonComparison = {
  previousSeason: string;
  revenueChange: number;
  planCompletionChange: number;
  fillRateChange: number;
  loyaltyDiscountPctChange: number;
  ticketsChange: number;
  avgPriceChange: number;
};

export type TicketsKpiData = {
  revenue: number;
  revenueChange: number;
  ticketsSold: number;
  ticketsChange: number;
  avgPrice: number;
  avgPriceChange: number;
  loyaltyDiscount: number;
  loyaltyDiscountPct: number;
  loyaltyDiscountChange: number;
  fillRate: number;
  planCompletionPct: number;
  planTicketsSold: number;
  planFactTicketsSold: number;
  revenueToday: number;
  ticketsToday: number;
  revenueSparkline: number[];
  ticketsSparkline: number[];
  seasonComparison?: TicketsSeasonComparison;
};

export type MerchSeasonComparison = {
  previousSeason: string;
  revenueChange: number;
  avgCheckChange: number;
  receiptsChange: number;
  returnsPctChange: number;
  marginPctChange: number;
};

export type MerchKpiData = {
  revenue: number;
  avgCheck: number;
  upt: number;
  receipts: number;
  returnsPct: number;
  marginPct: number;
  seasonComparison?: MerchSeasonComparison;
};

export type SubscriptionsSeasonComparison = {
  previousSeason: string;
  revenueChange: number;
  soldChange: number;
  uniqueCustomersChange: number;
  avgCheckChange: number;
};

export type SubscriptionsKpiData = {
  revenue: number;
  revenueChange: number;
  sold: number;
  soldChange: number;
  uniqueCustomers: number;
  uniqueCustomersChange: number;
  avgCheck: number;
  avgCheckChange: number;
  revenueSparkline: number[];
  soldSparkline: number[];
  seasonComparison?: SubscriptionsSeasonComparison;
};

export type KpiData = {
  totalRevenue: number;
  totalRevenueChange: number;
  ticketsSold: number;
  fillRate: number;
  ticketsChange: number;
  merchRevenue: number;
  merchChange: number;
  promoEffect: number;
  promoEffectChange: number;
  revenueSparkline: number[];
  ticketsSparkline: number[];
  merchSparkline: number[];
  promoSparkline: number[];
};

export type WeeklyRevenuePoint = {
  week: string;
  tickets: number;
  merch: number;
  total: number;
};

export type MatchRevenuePoint = {
  match: string;
  tickets: number;
  merch: number;
};

export type SectorPoint = {
  sector: string;
  value: number;
};

export type TicketTypeSalesPoint = {
  type: TicketType;
  label: string;
  tickets: number;
  revenue: number;
  share: number;
};

export type OrderSourceSalesPoint = {
  source: OrderSource;
  label: string;
  tickets: number;
  revenue: number;
  share: number;
};

export type MerchByMatchPoint = {
  match: string;
  merch: number;
};

export type PromotionRow = Promotion & {
  conversionRate: number;
  roi: number;
};

export type PromotionKpi = {
  id: string;
  name: string;
  reach: number;
  conversions: number;
  conversionRate: number;
  roi: number;
};
