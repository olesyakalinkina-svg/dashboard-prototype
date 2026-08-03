"use client";

import {
  OrderSourceSalesChart,
  PriceZoneSalesChart,
  TicketTypeSalesChart,
} from "@/components/widgets/Charts";
import type {
  OrderSourceSalesPoint,
  PriceZoneSalesPoint,
  TicketTypeSalesPoint,
} from "@/types/dashboard";

type TicketsBreakdownWidgetProps = {
  ticketTypeSales: TicketTypeSalesPoint[];
  priceZoneSales: PriceZoneSalesPoint[];
  orderSourceSales: OrderSourceSalesPoint[];
  refreshKey?: string;
};

export function TicketsBreakdownWidget({
  ticketTypeSales,
  priceZoneSales,
  orderSourceSales,
  refreshKey,
}: TicketsBreakdownWidgetProps) {
  return (
    <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-3">
      <TicketTypeSalesChart data={ticketTypeSales} refreshKey={refreshKey} />
      <PriceZoneSalesChart data={priceZoneSales} refreshKey={refreshKey} />
      <OrderSourceSalesChart data={orderSourceSales} refreshKey={refreshKey} />
    </div>
  );
}
