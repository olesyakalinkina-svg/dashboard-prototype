import type { Transaction } from "@/types/dashboard";

export type TicketSalesAgg = {
  revenue: number;
  loyaltyDiscount: number;
  ticketsSold: number;
  freeTickets: number;
};

export function createTicketSalesAgg(): TicketSalesAgg {
  return {
    revenue: 0,
    loyaltyDiscount: 0,
    ticketsSold: 0,
    freeTickets: 0,
  };
}

export function getTicketFreeQuantity(tx: Transaction): number {
  return tx.freeQuantity ?? (tx.amount === 0 ? tx.quantity : 0);
}

export function getTicketIssuedQuantity(tx: Transaction): number {
  const freeQty = getTicketFreeQuantity(tx);
  return tx.amount > 0 ? freeQty + tx.quantity : freeQty;
}

export function applyTicketSalesTransaction(
  agg: TicketSalesAgg,
  tx: Transaction,
): void {
  agg.freeTickets += getTicketFreeQuantity(tx);
  if (tx.amount > 0) {
    agg.revenue += tx.amount;
    agg.ticketsSold += tx.quantity;
  }
  agg.loyaltyDiscount += tx.loyaltyDiscount ?? 0;
}

export function ticketSalesAvgPrice(agg: TicketSalesAgg): number {
  return agg.ticketsSold > 0 ? agg.revenue / agg.ticketsSold : 0;
}

export function ticketSalesLoyaltyDiscountPct(agg: TicketSalesAgg): number {
  const gross = agg.revenue + agg.loyaltyDiscount;
  return gross > 0 ? (agg.loyaltyDiscount / gross) * 100 : 0;
}

export function isEmptyTicketSalesAgg(
  agg: TicketSalesAgg,
  issuedTickets: number,
): boolean {
  return (
    issuedTickets === 0 &&
    agg.revenue === 0 &&
    agg.ticketsSold === 0 &&
    agg.freeTickets === 0
  );
}
