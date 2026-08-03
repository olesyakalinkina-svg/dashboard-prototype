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

export type League = "KHL" | "VHL" | "MHL";
export type TournamentStage = "regular" | "playoff";
export type ArenaId = "main" | "secondary";
export type TicketType = "parking" | "arena";
export type PriceZone =
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
  sector?: string;
  ticketType?: TicketType;
  priceZone?: PriceZone;
  orderSource?: OrderSource;
  merchSalesPoint?: MerchSalesPoint;
  isReturn?: boolean;
  costAmount?: number;
};

export type MatchSalesRow = {
  matchId: string;
  eventLabel: string;
  date: Date;
  revenue: number;
  avgPrice: number;
  ticketsSold: number;
  freeTickets: number;
  loyaltyDiscountPct: number;
};

export type MerchMatchSalesRow = {
  matchId: string;
  eventLabel: string;
  date: Date;
  revenue: number;
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
  arena: ArenaId;
  eventCompleted: boolean;
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

export type TicketFilters = {
  season: string | "all";
  league: League | "all";
  tournamentStage: TournamentStage | "all";
  arena: ArenaId | "all";
  eventCompleted: "all" | "yes" | "no";
  matchId: string | "all";
  ticketType: TicketType | "all";
  priceZone: PriceZone | "all";
  orderSource: OrderSource | "all";
  timeGrouping: TimeGrouping;
};

export type MerchFilters = {
  season: string | "all";
  league: League | "all";
  tournamentStage: TournamentStage | "all";
  matchId: string | "all";
  salesChannels: MerchSalesPoint[];
  timeGrouping: TimeGrouping;
};

export type SubscriptionFilters = {
  season: string | "all";
  league: League | "all";
  tournamentStage: TournamentStage | "all";
  arena: ArenaId | "all";
  ticketType: TicketType | "all";
  priceZone: PriceZone | "all";
};

export type DashboardTab = "subscriptions" | "tickets" | "merch";

export type SubscriptionStatus = "active" | "expired" | "fully_used" | "cancelled";

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
  priceZone: PriceZone;
};

export type SubscriptionPlanStat = {
  plan: string;
  sold: number;
  revenue: number;
  utilization: number;
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

export type TicketMatchCumulativePoint = {
  date: string;
  dateKey: number;
  revenue: number;
  tickets: number;
};

export type TicketMatchCumulativeSeries = {
  matchId: string;
  label: string;
  color: string;
  league: League;
  season: string;
  points: TicketMatchCumulativePoint[];
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
  revenueToday: number;
  ticketsToday: number;
  revenueSparkline: number[];
  ticketsSparkline: number[];
};

export type MerchKpiData = {
  revenue: number;
  avgCheck: number;
  upt: number;
  receipts: number;
  returnsPct: number;
  marginPct: number;
};

export type SubscriptionsKpiData = {
  revenue: number;
  revenueChange: number;
  sold: number;
  soldChange: number;
  avgUtilization: number;
  activeCount: number;
  revenueSparkline: number[];
  soldSparkline: number[];
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

export type PriceZoneSalesPoint = {
  zone: PriceZone;
  label: string;
  tickets: number;
  revenue: number;
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
