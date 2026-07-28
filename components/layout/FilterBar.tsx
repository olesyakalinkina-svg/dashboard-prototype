"use client";

import { useFilters } from "@/context/FilterContext";
import { TicketsFilterBar } from "@/components/layout/TicketsFilterBar";
import { MerchFilterBar } from "@/components/layout/MerchFilterBar";
import { SubscriptionsFilterBar } from "@/components/layout/SubscriptionsFilterBar";

export function FilterBar() {
  const { activeTab } = useFilters();
  if (activeTab === "tickets") {
    return <TicketsFilterBar />;
  }

  if (activeTab === "merch") {
    return <MerchFilterBar />;
  }

  if (activeTab === "subscriptions") {
    return <SubscriptionsFilterBar />;
  }

  return null;
}
