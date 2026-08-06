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
};

export function TicketsBreakdownWidget({
  ticketTypeSales,
  priceZoneSales,
  orderSourceSales,
}: TicketsBreakdownWidgetProps) {
  return (
    <section className="min-w-0">
      <div className="grid min-w-0 grid-cols-1 items-start gap-4 xl:grid-cols-[1fr_1.4fr] xl:grid-rows-2">
        <div className="min-w-0 xl:col-start-1 xl:row-start-1">
          <TicketTypeSalesChart data={ticketTypeSales} />
        </div>
        <div className="min-w-0 xl:col-start-1 xl:row-start-2">
          <OrderSourceSalesChart data={orderSourceSales} />
        </div>
        <div className="min-w-0 h-full xl:col-start-2 xl:row-span-2 xl:row-start-1 xl:self-stretch">
          <PriceZoneSalesChart data={priceZoneSales} fillHeight />
        </div>
      </div>
    </section>
  );
}
