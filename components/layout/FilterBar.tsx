"use client";

import dynamic from "next/dynamic";
import { useFilterState } from "@/context/FilterContext";

const TicketsFilterBar = dynamic(
  () =>
    import("@/components/layout/TicketsFilterBar").then((mod) => ({
      default: mod.TicketsFilterBar,
    })),
  { ssr: false },
);

const MerchFilterBar = dynamic(
  () =>
    import("@/components/layout/MerchFilterBar").then((mod) => ({
      default: mod.MerchFilterBar,
    })),
  { ssr: false },
);

const MatchSalesFilterBar = dynamic(
  () =>
    import("@/components/layout/MatchSalesFilterBar").then((mod) => ({
      default: mod.MatchSalesFilterBar,
    })),
  { ssr: false },
);

const SubscriptionsFilterBar = dynamic(
  () =>
    import("@/components/layout/SubscriptionsFilterBar").then((mod) => ({
      default: mod.SubscriptionsFilterBar,
    })),
  { ssr: false },
);

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
