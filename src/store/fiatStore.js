import { create } from "zustand";

// UI state for the fiat wallet page — which panel/tab is active, pending deposit info.
// Server data lives in React Query; this store only tracks transient UI state.

export const useFiatStore = create((set) => ({
  // "deposit" | "withdraw" | null
  activePanel: null,
  setActivePanel: (panel) => set({ activePanel: panel }),

  // Tracks a pending deposit while user is shown bank transfer instructions
  pendingDeposit: null,  // { txId, reference, currency, amount, bankDetails, instruction, expiresInMinutes }
  setPendingDeposit: (dep) => set({ pendingDeposit: dep }),
  clearPendingDeposit: () => set({ pendingDeposit: null }),

  // "USD" | "EUR" | "NGN"
  selectedCurrency: "USD",
  setSelectedCurrency: (c) => set({ selectedCurrency: c }),

  // Transaction list filter state
  txFilter: { type: "", currency: "", status: "", page: 1 },
  setTxFilter: (patch) =>
    set((s) => ({ txFilter: { ...s.txFilter, ...patch, page: 1 } })),
  setTxPage: (page) => set((s) => ({ txFilter: { ...s.txFilter, page } })),

  // Add-bank-account modal open state
  addBankOpen: false,
  setAddBankOpen: (v) => set({ addBankOpen: v }),
}));
