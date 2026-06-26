import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../api/queryKeys.js";
import { walletApi } from "../../services/api/wallet.js";

// Fetches all enabled chains + their supported assets from the backend.
// Returns a map: { ETH: [{network, label, confirmations}], USDT: [...], ... }
// Completely dynamic — driven by env vars, no hardcoding on the frontend.
export const useAssetChainMap = () =>
  useQuery({
    queryKey: queryKeys.blockchain.chains,
    queryFn:  () => walletApi.getBlockchainChains(),
    staleTime: 5 * 60_000,
    retry: false,
    select: (res) => {
      const chains = res?.data ?? [];
      const map = {};
      for (const chain of chains) {
        const entry = { network: chain.id, label: chain.label, confirmations: chain.confirmations };
        if (!map[chain.nativeAsset]) map[chain.nativeAsset] = [];
        map[chain.nativeAsset].push(entry);
        for (const sym of Object.keys(chain.tokens ?? {})) {
          if (!map[sym]) map[sym] = [];
          map[sym].push(entry);
        }
      }
      return map;
    },
  });

export const useDepositAddressQuery = (asset, network) =>
  useQuery({
    queryKey: queryKeys.blockchain.depositAddress(asset, network),
    queryFn:  () => walletApi.getDepositAddress(asset, network),
    enabled:  Boolean(asset && network),
    staleTime: Infinity,
    retry: false,
    select: (data) => data?.data,
  });

export const useUidLookupQuery = (uid) =>
  useQuery({
    queryKey: queryKeys.transfer.lookup(uid),
    queryFn:  () => walletApi.lookupByUid(uid),
    enabled:  Boolean(uid && /^\d{8}$/.test(uid)),
    staleTime: 60_000,
    retry: false,
  });

export const useMyWalletsQuery = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.wallet.myWallets,
    queryFn:  () => walletApi.getWallets(),
    enabled,
    staleTime: 30_000,
    select: (data) => data?.wallets ?? [],
  });

export const useWalletTransactionsQuery = (params = {}, enabled = true) =>
  useQuery({
    queryKey: queryKeys.wallet.transactions(params),
    queryFn:  () => walletApi.getTransactions(params),
    enabled,
    staleTime: 20_000,
  });

export const useDepositMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => walletApi.deposit(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet.myWallets });
      qc.invalidateQueries({ queryKey: queryKeys.wallet.allTransactions });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
};

export const useWithdrawMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => walletApi.withdraw(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet.myWallets });
      qc.invalidateQueries({ queryKey: queryKeys.wallet.allTransactions });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
};

export const useInternalTransferMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => walletApi.internalTransfer(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet.myWallets });
      qc.invalidateQueries({ queryKey: queryKeys.wallet.allTransactions });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    },
  });
};
