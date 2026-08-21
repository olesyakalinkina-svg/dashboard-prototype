"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useFilterState } from "@/context/FilterContext";
import {
  filterMatchesByMatchSalesFilters,
  filterMatchesByMerchFilters,
  filterMatchesByTicketFilters,
} from "@/lib/filters";
import {
  applyMatchSalesFilterPatch,
  DEFAULT_MATCH_SALES_FILTERS,
} from "@/lib/match-sales-filter-options";
import { DEFAULT_MERCH_FILTERS } from "@/lib/merch-filter-options";
import {
  applySubscriptionFilterPatch,
  DEFAULT_SUBSCRIPTION_FILTERS,
} from "@/lib/subscription-filter-options";
import {
  applyTicketFilterPatch,
  buildMatchFilterOptions,
  buildSeriesFilterOptions,
  DEFAULT_TICKET_FILTERS,
  sanitizeSeriesForOptions,
} from "@/lib/ticket-filter-options";
import type {
  MatchSalesFilters,
  MerchFilters,
  SubscriptionFilters,
  TicketFilters,
} from "@/types/dashboard";

type DraftFilters = {
  ticketFilters: TicketFilters;
  merchFilters: MerchFilters;
  matchSalesFilters: MatchSalesFilters;
  subscriptionFilters: SubscriptionFilters;
};

type MobileFilterDraftContextValue = {
  isDraft: boolean;
  draft: DraftFilters;
  setTicketFilters: (patch: Partial<TicketFilters>) => void;
  setMerchFilters: (patch: Partial<MerchFilters>) => void;
  setMatchSalesFilters: (patch: Partial<MatchSalesFilters>) => void;
  setSubscriptionFilters: (patch: Partial<SubscriptionFilters>) => void;
  resetTicketFilters: () => void;
  resetMerchFilters: () => void;
  resetMatchSalesFilters: () => void;
  resetSubscriptionFilters: () => void;
  ticketMatchOptions: ReturnType<typeof buildMatchFilterOptions>;
  merchMatchOptions: ReturnType<typeof buildMatchFilterOptions>;
  matchSalesMatchOptions: ReturnType<typeof buildMatchFilterOptions>;
  ticketSeriesOptions: ReturnType<typeof buildSeriesFilterOptions>;
  merchSeriesOptions: ReturnType<typeof buildSeriesFilterOptions>;
  matchSalesSeriesOptions: ReturnType<typeof buildSeriesFilterOptions>;
  applyDraft: () => void;
};

const MobileFilterDraftContext =
  createContext<MobileFilterDraftContextValue | null>(null);

export { MobileFilterDraftContext };

function snapshotDraftFilters(live: ReturnType<typeof useFilterState>): DraftFilters {
  return {
    ticketFilters: {
      ...live.ticketFilters,
      matchId: [...live.ticketFilters.matchId],
      sector: [...live.ticketFilters.sector],
      transactionDateRange: { ...live.ticketFilters.transactionDateRange },
    },
    merchFilters: {
      ...live.merchFilters,
      salesChannels: [...live.merchFilters.salesChannels],
      productCategories: [...live.merchFilters.productCategories],
      matchId: [...live.merchFilters.matchId],
    },
    matchSalesFilters: {
      ...live.matchSalesFilters,
      matchId: [...live.matchSalesFilters.matchId],
      purchaseDateRange: { ...live.matchSalesFilters.purchaseDateRange },
    },
    subscriptionFilters: { ...live.subscriptionFilters },
  };
}

export function MobileFilterDraftProvider({
  children,
  onClose,
}: {
  children: ReactNode;
  onClose: () => void;
}) {
  const live = useFilterState();
  const [draft, setDraft] = useState<DraftFilters>(() => snapshotDraftFilters(live));

  const setTicketFilters = useCallback((patch: Partial<TicketFilters>) => {
    setDraft((prev) => ({
      ...prev,
      ticketFilters: applyTicketFilterPatch(prev.ticketFilters, patch),
    }));
  }, []);

  const setMerchFilters = useCallback((patch: Partial<MerchFilters>) => {
    setDraft((prev) => ({
      ...prev,
      merchFilters: { ...prev.merchFilters, ...patch },
    }));
  }, []);

  const setMatchSalesFilters = useCallback(
    (patch: Partial<MatchSalesFilters>) => {
      setDraft((prev) => ({
        ...prev,
        matchSalesFilters: applyMatchSalesFilterPatch(
          prev.matchSalesFilters,
          patch,
        ),
      }));
    },
    [],
  );

  const setSubscriptionFilters = useCallback(
    (patch: Partial<SubscriptionFilters>) => {
      setDraft((prev) => ({
        ...prev,
        subscriptionFilters: applySubscriptionFilterPatch(
          prev.subscriptionFilters,
          patch,
        ),
      }));
    },
    [],
  );

  const resetTicketFilters = useCallback(() => {
    live.resetTicketFilters();
    setDraft((prev) => ({
      ...prev,
      ticketFilters: {
        ...DEFAULT_TICKET_FILTERS,
        matchId: [...DEFAULT_TICKET_FILTERS.matchId],
        sector: [...DEFAULT_TICKET_FILTERS.sector],
        transactionDateRange: { ...DEFAULT_TICKET_FILTERS.transactionDateRange },
      },
    }));
  }, [live.resetTicketFilters]);

  const resetMerchFilters = useCallback(() => {
    live.resetMerchFilters();
    setDraft((prev) => ({
      ...prev,
      merchFilters: {
        ...DEFAULT_MERCH_FILTERS,
        salesChannels: [...DEFAULT_MERCH_FILTERS.salesChannels],
        productCategories: [...DEFAULT_MERCH_FILTERS.productCategories],
        matchId: [...DEFAULT_MERCH_FILTERS.matchId],
        orderDateRange: { ...DEFAULT_MERCH_FILTERS.orderDateRange },
      },
    }));
  }, [live.resetMerchFilters]);

  const resetMatchSalesFilters = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      matchSalesFilters: {
        ...DEFAULT_MATCH_SALES_FILTERS,
        matchId: [],
        purchaseDateRange: { ...DEFAULT_MATCH_SALES_FILTERS.purchaseDateRange },
      },
    }));
  }, []);

  const resetSubscriptionFilters = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      subscriptionFilters: { ...DEFAULT_SUBSCRIPTION_FILTERS },
    }));
  }, []);

  const ticketMatchOptions = useMemo(
    () =>
      buildMatchFilterOptions(
        filterMatchesByTicketFilters({
          ...draft.ticketFilters,
          matchId: [],
        }),
      ),
    [
      draft.ticketFilters.season,
      draft.ticketFilters.league,
      draft.ticketFilters.tournamentStage,
      draft.ticketFilters.matchClass,
      draft.ticketFilters.series,
      draft.ticketFilters.arena,
      draft.ticketFilters.eventCompleted,
    ],
  );

  const ticketSeriesOptions = useMemo(
    () =>
      buildSeriesFilterOptions(
        filterMatchesByTicketFilters({
          ...draft.ticketFilters,
          matchId: [],
          series: "all",
        }),
      ),
    [
      draft.ticketFilters.season,
      draft.ticketFilters.league,
      draft.ticketFilters.tournamentStage,
      draft.ticketFilters.matchClass,
      draft.ticketFilters.arena,
      draft.ticketFilters.eventCompleted,
    ],
  );

  const merchMatchOptions = useMemo(
    () =>
      buildMatchFilterOptions(
        filterMatchesByMerchFilters({ ...draft.merchFilters, matchId: [] }),
      ),
    [
      draft.merchFilters.season,
      draft.merchFilters.league,
      draft.merchFilters.tournamentStage,
      draft.merchFilters.matchClass,
      draft.merchFilters.series,
    ],
  );

  const merchSeriesOptions = useMemo(
    () =>
      buildSeriesFilterOptions(
        filterMatchesByMerchFilters({
          ...draft.merchFilters,
          matchId: [],
          series: "all",
        }),
      ),
    [
      draft.merchFilters.season,
      draft.merchFilters.league,
      draft.merchFilters.tournamentStage,
      draft.merchFilters.matchClass,
    ],
  );

  const matchSalesMatchOptions = useMemo(
    () =>
      buildMatchFilterOptions(
        filterMatchesByMatchSalesFilters({
          ...draft.matchSalesFilters,
          matchId: [],
        }),
      ),
    [
      draft.matchSalesFilters.season,
      draft.matchSalesFilters.league,
      draft.matchSalesFilters.tournamentStage,
      draft.matchSalesFilters.matchClass,
      draft.matchSalesFilters.series,
      draft.matchSalesFilters.arena,
      draft.matchSalesFilters.eventCompleted,
    ],
  );

  const matchSalesSeriesOptions = useMemo(
    () =>
      buildSeriesFilterOptions(
        filterMatchesByMatchSalesFilters({
          ...draft.matchSalesFilters,
          matchId: [],
          series: "all",
        }),
      ),
    [
      draft.matchSalesFilters.season,
      draft.matchSalesFilters.league,
      draft.matchSalesFilters.tournamentStage,
      draft.matchSalesFilters.matchClass,
      draft.matchSalesFilters.arena,
      draft.matchSalesFilters.eventCompleted,
    ],
  );

  useEffect(() => {
    const next = sanitizeSeriesForOptions(
      draft.ticketFilters.series,
      ticketSeriesOptions,
    );
    if (next !== draft.ticketFilters.series) {
      setTicketFilters({ series: next });
    }
  }, [draft.ticketFilters.series, setTicketFilters, ticketSeriesOptions]);

  useEffect(() => {
    const next = sanitizeSeriesForOptions(
      draft.merchFilters.series,
      merchSeriesOptions,
    );
    if (next !== draft.merchFilters.series) {
      setMerchFilters({ series: next });
    }
  }, [draft.merchFilters.series, merchSeriesOptions, setMerchFilters]);

  useEffect(() => {
    const next = sanitizeSeriesForOptions(
      draft.matchSalesFilters.series,
      matchSalesSeriesOptions,
    );
    if (next !== draft.matchSalesFilters.series) {
      setMatchSalesFilters({ series: next });
    }
  }, [
    draft.matchSalesFilters.series,
    matchSalesSeriesOptions,
    setMatchSalesFilters,
  ]);

  const applyDraft = useCallback(() => {
    if (live.activeTab === "tickets") {
      live.setTicketFilters(draft.ticketFilters);
    } else if (live.activeTab === "merch") {
      live.setMerchFilters(draft.merchFilters);
    } else if (live.activeTab === "matches") {
      live.setMatchSalesFilters(draft.matchSalesFilters);
    } else if (live.activeTab === "subscriptions") {
      live.setSubscriptionFilters(draft.subscriptionFilters);
    }
    onClose();
  }, [draft, live, onClose]);

  const value = useMemo<MobileFilterDraftContextValue>(
    () => ({
      isDraft: true,
      draft,
      setTicketFilters,
      setMerchFilters,
      setMatchSalesFilters,
      setSubscriptionFilters,
      resetTicketFilters,
      resetMerchFilters,
      resetMatchSalesFilters,
      resetSubscriptionFilters,
      ticketMatchOptions,
      merchMatchOptions,
      matchSalesMatchOptions,
      ticketSeriesOptions,
      merchSeriesOptions,
      matchSalesSeriesOptions,
      applyDraft,
    }),
    [
      draft,
      setTicketFilters,
      setMerchFilters,
      setMatchSalesFilters,
      setSubscriptionFilters,
      resetTicketFilters,
      resetMerchFilters,
      resetMatchSalesFilters,
      resetSubscriptionFilters,
      ticketMatchOptions,
      merchMatchOptions,
      matchSalesMatchOptions,
      ticketSeriesOptions,
      merchSeriesOptions,
      matchSalesSeriesOptions,
      applyDraft,
    ],
  );

  return (
    <MobileFilterDraftContext.Provider value={value}>
      {children}
    </MobileFilterDraftContext.Provider>
  );
}

export function useFilterBarState() {
  const draft = useContext(MobileFilterDraftContext);
  const live = useFilterState();

  if (!draft?.isDraft) {
    return live;
  }

  return {
    ...live,
    ticketFilters: draft.draft.ticketFilters,
    merchFilters: draft.draft.merchFilters,
    matchSalesFilters: draft.draft.matchSalesFilters,
    subscriptionFilters: draft.draft.subscriptionFilters,
    setTicketFilters: draft.setTicketFilters,
    setMerchFilters: draft.setMerchFilters,
    setMatchSalesFilters: draft.setMatchSalesFilters,
    setSubscriptionFilters: draft.setSubscriptionFilters,
    resetTicketFilters: draft.resetTicketFilters,
    resetMerchFilters: draft.resetMerchFilters,
    resetMatchSalesFilters: draft.resetMatchSalesFilters,
    resetSubscriptionFilters: draft.resetSubscriptionFilters,
    ticketMatchOptions: draft.ticketMatchOptions,
    merchMatchOptions: draft.merchMatchOptions,
    matchSalesMatchOptions: draft.matchSalesMatchOptions,
    ticketSeriesOptions: draft.ticketSeriesOptions,
    merchSeriesOptions: draft.merchSeriesOptions,
    matchSalesSeriesOptions: draft.matchSalesSeriesOptions,
  };
}
