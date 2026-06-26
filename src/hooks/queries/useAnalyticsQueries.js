import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "../../services/api/analytics.js";
import { queryKeys }    from "../../api/queryKeys.js";

const defaultOpts = { staleTime: 5 * 60 * 1000, retry: 1 };

export const useInsightsQuery = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.analytics.insights,
    queryFn:  () => analyticsApi.insights(),
    ...defaultOpts,
    enabled,
  });

export const usePortfolioQuery = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.analytics.portfolio,
    queryFn:  () => analyticsApi.portfolio(),
    ...defaultOpts,
    enabled,
  });

export const usePnLQuery = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.analytics.pnl,
    queryFn:  () => analyticsApi.pnl(),
    ...defaultOpts,
    enabled,
  });

export const useActivityQuery = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.analytics.activity,
    queryFn:  () => analyticsApi.activity(),
    ...defaultOpts,
    enabled,
  });

export const useMarketAnalyticsQuery = (enabled = true) =>
  useQuery({
    queryKey: queryKeys.analytics.market,
    queryFn:  () => analyticsApi.market(),
    staleTime: 60_000,
    retry:     1,
    enabled,
  });

export const usePatternsQuery = (symbol, interval = "1h", enabled = true) =>
  useQuery({
    queryKey: queryKeys.analytics.patterns(symbol, interval),
    queryFn:  () => analyticsApi.patterns(symbol, interval),
    staleTime: 2 * 60_000,
    retry:     1,
    enabled:   enabled && Boolean(symbol),
  });
