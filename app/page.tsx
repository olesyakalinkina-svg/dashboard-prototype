"use client";

import dynamic from "next/dynamic";
import { DashboardLoading } from "@/components/layout/DashboardLoading";

const DashboardApp = dynamic(() => import("./dashboard-app"), {
  ssr: false,
  loading: () => <DashboardLoading />,
});

export default function Home() {
  return <DashboardApp />;
}
