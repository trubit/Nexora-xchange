import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { requestWithRetry } from "./client";
import { queryKeys } from "./queryKeys";

// ── Wallet ─────────────────────────────────────────────────────────────────────

export const useFiatWalletQuery = () =>
  useQuery({
    queryKey: queryKeys.fiat.wallet,
    queryFn:  () => requestWithRetry({ method: "get", url: "/api/fiat/wallet" }),
    staleTime: 30_000,
  });

// ── Bank accounts ──────────────────────────────────────────────────────────────

export const useBankAccountsQuery = () =>
  useQuery({
    queryKey: queryKeys.fiat.bankAccounts,
    queryFn:  () => requestWithRetry({ method: "get", url: "/api/fiat/bank-accounts" }),
    staleTime: 60_000,
  });

export const useLinkBankAccountMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) =>
      requestWithRetry({ method: "post", url: "/api/fiat/bank-accounts", data: payload }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.fiat.bankAccounts }),
  });
};

export const useSetPrimaryBankAccountMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      requestWithRetry({ method: "patch", url: `/api/fiat/bank-accounts/${id}/primary` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.fiat.bankAccounts }),
  });
};

export const useDeleteBankAccountMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      requestWithRetry({ method: "delete", url: `/api/fiat/bank-accounts/${id}` }),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.fiat.bankAccounts }),
  });
};

// ── Deposit ────────────────────────────────────────────────────────────────────

export const useInitiateDepositMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ currency, amount }) =>
      requestWithRetry({
        method: "post",
        url:    "/api/fiat/deposit/initiate",
        data:   { currency, amount },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fiat.wallet });
      qc.invalidateQueries({ queryKey: queryKeys.fiat.transactions() });
    },
  });
};

export const useConfirmDepositMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (txId) =>
      requestWithRetry({
        method: "post",
        url:    "/api/fiat/deposit/confirm",
        data:   { txId },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fiat.wallet });
      qc.invalidateQueries({ queryKey: queryKeys.fiat.transactions() });
    },
  });
};

// ── Withdrawal ─────────────────────────────────────────────────────────────────

export const useWithdrawMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ bankAccountId, currency, amount }) =>
      requestWithRetry({
        method: "post",
        url:    "/api/fiat/withdraw",
        data:   { bankAccountId, currency, amount },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.fiat.wallet });
      qc.invalidateQueries({ queryKey: queryKeys.fiat.transactions() });
    },
  });
};

export const useWithdrawalFeeQuery = (currency, amount) =>
  useQuery({
    queryKey: queryKeys.fiat.feePreview(currency, amount),
    queryFn:  () =>
      requestWithRetry({
        method: "get",
        url:    "/api/fiat/withdrawal/fee",
        params: { currency, amount },
      }),
    enabled: Boolean(currency && amount > 0),
    staleTime: 60_000,
  });

// ── Transactions ───────────────────────────────────────────────────────────────

export const useFiatTransactionsQuery = (params = {}) =>
  useQuery({
    queryKey: queryKeys.fiat.transactions(params),
    queryFn:  () =>
      requestWithRetry({ method: "get", url: "/api/fiat/transactions", params }),
    staleTime: 20_000,
    keepPreviousData: true,
  });

export const useFiatTransactionQuery = (txId) =>
  useQuery({
    queryKey: queryKeys.fiat.transaction(txId),
    queryFn:  () =>
      requestWithRetry({ method: "get", url: `/api/fiat/transactions/${txId}` }),
    enabled: Boolean(txId),
    staleTime: 30_000,
  });
