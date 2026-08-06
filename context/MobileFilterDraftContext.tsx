"use client";

import {
  createContext,
  useCallback,
  useContext,
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
import { DEFAULT_MATCH_SALES_FILTERS } from "@/lib/match-sales-filter-options";
import { DEFAULT_MERCH_FILTERS } from "@/lib/merch-filter-options";
import { DEFAULT_SUBSCRIPTION_FILTERS } from "@/lib/subscription-filter-options";
import {
  buildMatchFilterOptions,
  DEFAULT_TICKET_FILTERS,
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
      transactionDateRange: { ...live.ticketFilters.transactionDateRange },
    },
    merchFilters: {
      ...live.merchFilters,
      salesChannels: [...live.merchFilters.salesChannels],
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
      ticketFilters: { ...prev.ticketFilters, ...patch },
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
        matchSalesFilters: { ...prev.matchSalesFilters, ...patch },
      }));
    },
    [],
  );

  const setSubscriptionFilters = useCallback(
    (patch: Partial<SubscriptionFilters>) => {
      setDraft((prev) => ({
        ...prev,
        subscriptionFilters: { ...prev.subscriptionFilters, ...patch },
      }));
    },
    [],
  );

  const resetTicketFilters = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      ticketFilters: { ...DEFAULT_TICKET_FILTERS },
    }));
  }, []);

  const resetMerchFilters = useCallback(() => {
    setDraft((prev) => ({
      ...prev,
      merchFilters: {
        ...DEFAULT_MERCH_FILTERS,
        salesChannels: [...DEFAULT_MERCH_FILTERS.salesChannels],
      },
    }));
  }, []);

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
        filterMatchesByTicketFilters({ ...draft.ticketFilters, matchId: [] }),
      ),
    [draft.ticketFilters],
  );

  const merchMatchOptions = useMemo(
    () =>
      buildMatchFilterOptions(
        filterMatchesByMerchFilters({ ...draft.merchFilters, matchId: [] }),
      ),
    [draft.merchFilters],
  );

  const matchSalesMatchOptions = useMemo(
    () =>
      buildMatchFilterOptions(
        filterMatchesByMatchSalesFilters({
          ...draft.matchSalesFilters,
          matchId: [],
        }),
      ),
    [draft.matchSalesFilters],
  );

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
  };
}
