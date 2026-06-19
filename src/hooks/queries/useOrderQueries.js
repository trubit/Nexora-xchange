import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../../api/queryKeys.js";
import { ordersApi } from "../../services/api/orders.js";

export const useOpenOrdersQuery = (params = {}, enabled = true) =>
  useQuery({
    queryKey: queryKeys.orders.open(params),
    queryFn:  () => ordersApi.getOpenOrders(params),
    enabled,
    staleTime: 10_000,
    refetchInterval: 15_000,
    select: (data) => data?.orders ?? [],
  });

export const useOrderHistoryQuery = (params = {}, enabled = true) =>
  useQuery({
    queryKey: queryKeys.orders.history(params),
    queryFn:  () => ordersApi.getOrderHistory(params),
    enabled,
    staleTime: 20_000,
  });

const invalidateOrderCaches = (qc, symbol) => {
  qc.invalidateQueries({ queryKey: queryKeys.orders.open({}) });
  qc.invalidateQueries({ queryKey: queryKeys.wallet.myWallets });
  qc.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
  if (symbol) {
    qc.invalidateQueries({ queryKey: queryKeys.trade.myMarketState(symbol) });
    qc.invalidateQueries({ queryKey: queryKeys.trade.marketState(symbol) });
  }
};

export const useCreateOrderMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => ordersApi.createOrder(payload),
    onSuccess: (data, variables) => invalidateOrderCaches(qc, variables?.symbol),
  });
};

export const useCreateOCOOrderMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload) => ordersApi.createOCOOrder(payload),
    onSuccess: (data, variables) => invalidateOrderCaches(qc, variables?.symbol),
  });
};

export const useCancelOrderMutation = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (orderId) => ordersApi.cancelOrder(orderId),
    onSuccess: (data) => {
      const symbol = data?.order?.symbol;
      qc.invalidateQueries({ queryKey: queryKeys.orders.open({}) });
      qc.invalidateQueries({ queryKey: queryKeys.orders.history({}) });
      qc.invalidateQueries({ queryKey: queryKeys.wallet.myWallets });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
      if (symbol) {
        qc.invalidateQueries({ queryKey: queryKeys.trade.myMarketState(symbol) });
        qc.invalidateQueries({ queryKey: queryKeys.trade.marketState(symbol) });
      }
    },
  });
};
