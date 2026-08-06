"use client";

import { useFilterState } from "@/context/FilterContext";
import { TicketsFilterBar } from "@/components/layout/TicketsFilterBar";
import { MerchFilterBar } from "@/components/layout/MerchFilterBar";
import { MatchSalesFilterBar } from "@/components/layout/MatchSalesFilterBar";
import { SubscriptionsFilterBar } from "@/components/layout/SubscriptionsFilterBar";

export function FilterBar() {
  const { activeTab } = useFilterState();
  if (activeTab === "tickets") {
    return <TicketsFilterBar />;
  }

  if (activeTab === "merch") {
    return <MerchFilterBar />;
  }

  if (activeTab === "matches") {
    return <MatchSalesFilterBar />;
  }

  if (activeTab === "subscriptions") {
    return <SubscriptionsFilterBar />;
  }

  return null;
}
