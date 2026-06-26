import { useQuery } from "@tanstack/react-query";
import { requestWithRetry } from "../../api/client";

const fetchLogoMap = async () => {
  const res = await requestWithRetry({ method: "get", url: "/api/coins" });
  const map = {};
  for (const c of res?.coins || []) {
    if (c.symbol && c.logoUrl) map[c.symbol.toUpperCase()] = c.logoUrl;
  }
  return map;
};

export const useCoinLogos = () =>
  useQuery({
    queryKey:  ["coin-logos"],
    queryFn:   fetchLogoMap,
    staleTime: 5 * 60_000,
    refetchOnWindowFocus: false,
  });
