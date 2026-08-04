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
    <section className="min-w-0 space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Структура продаж
        </h2>
        <p className="text-xs text-[var(--muted)]">
          Сравнение факта с планом по типу билета и источнику заказа
        </p>
      </div>
      <div className="grid min-w-0 grid-cols-1 items-stretch gap-4 xl:grid-cols-[1fr_1.4fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <TicketTypeSalesChart data={ticketTypeSales} />
          <OrderSourceSalesChart data={orderSourceSales} />
        </div>
        <PriceZoneSalesChart data={priceZoneSales} fillHeight />
      </div>
    </section>
  );
}
