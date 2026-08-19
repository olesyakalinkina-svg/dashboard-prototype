/** Shared sales-table column widths: name flexes, metrics stay rem-locked. */

export const SALES_COL_NAME = "w-auto min-w-0";
export const SALES_COL_DATE = "w-[7rem] max-w-[7rem]";
export const SALES_COL_MONEY = "w-[10.5rem] max-w-[10.5rem]";
export const SALES_COL_PERCENT = "w-[10.5rem] max-w-[10.5rem]";
export const SALES_COL_QTY_BAR = "w-[9rem] max-w-[9rem]";
export const SALES_COL_QTY = "w-[6.5rem] max-w-[6.5rem]";
export const SALES_COL_RECEIPTS = "w-[8rem] max-w-[8rem]";
export const SALES_COL_COMPACT_PCT = "w-[7rem] max-w-[7rem]";

export const STICKY_TABLE_ROW_HOVER_CLASS = "sticky-scroll-table-row-hover";

export const COMBINED_MATCH_SALES_COLUMN_WIDTHS: Record<string, string> = {
  eventLabel: SALES_COL_NAME,
  date: SALES_COL_DATE,
  ticketRevenue: SALES_COL_MONEY,
  merchRevenue: SALES_COL_MONEY,
  totalRevenue: SALES_COL_MONEY,
  ticketsSold: SALES_COL_QTY_BAR,
  fillRate: SALES_COL_PERCENT,
  merchReceipts: SALES_COL_RECEIPTS,
};

export const MATCH_SALES_COLUMN_WIDTHS: Record<string, string> = {
  eventLabel: SALES_COL_NAME,
  date: SALES_COL_DATE,
  revenue: SALES_COL_MONEY,
  planFulfillment: SALES_COL_PERCENT,
  avgPrice: SALES_COL_QTY_BAR,
  ticketsSold: SALES_COL_QTY_BAR,
  freeTickets: SALES_COL_QTY,
  issuedTickets: SALES_COL_PERCENT,
  loyaltyDiscountPct: SALES_COL_COMPACT_PCT,
};
