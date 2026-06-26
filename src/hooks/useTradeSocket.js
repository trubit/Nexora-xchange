import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "../api/queryKeys";
import { useSocketStore } from "../store/socketStore";

const getSocketUrl = () =>
  import.meta.env.DEV
    ? window.location.origin
    : (import.meta.env.VITE_TRUSON_API_URL || window.location.origin);

export const useTradeSocket = ({ symbol, isAuthenticated }) => {
  const queryClient = useQueryClient();
  const socketRef = useRef(null);
  const setStatus      = useSocketStore((s) => s.setStatus);
  const setActiveSymbol = useSocketStore((s) => s.setActiveSymbol);
  const markMessage    = useSocketStore((s) => s.markMessage);
  const resetReconnect = useSocketStore((s) => s.resetReconnect);
  const incrementReconnect = useSocketStore((s) => s.incrementReconnect);

  useEffect(() => {
    if (!symbol) return;
    setActiveSymbol(symbol);
    setStatus("connecting");

    const socket = io(getSocketUrl(), {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 20_000,
    });
    socketRef.current = socket;

    const applySnapshot = (data) => {
      const key = isAuthenticated
        ? queryKeys.trade.myMarketState(symbol)
        : queryKeys.trade.marketState(symbol);
      queryClient.setQueryData(key, data);
      if (data?.pairs) queryClient.setQueryData(queryKeys.trade.pairs, data.pairs);
    };

    const applyTicker = (ticker) => {
      [queryKeys.trade.marketState(symbol), queryKeys.trade.myMarketState(symbol)].forEach((key) => {
        queryClient.setQueryData(key, (prev) => {
          if (!prev) return prev;
          return { ...prev, ticker: { ...prev.ticker, ...ticker } };
        });
      });
    };

    socket.on("connect", () => {
      setStatus("connected");
      resetReconnect();
      socket.emit("subscribe", { symbol });
    });

    socket.on("disconnect",    () => setStatus("disconnected"));
    socket.on("connect_error", () => { setStatus("disconnected"); incrementReconnect(); });
    socket.on("reconnecting",  () => { setStatus("connecting");   incrementReconnect(); });
    socket.on("reconnect",     () => {
      setStatus("connected");
      resetReconnect();
      socket.emit("subscribe", { symbol });
    });

    socket.on("snapshot", (data) => { markMessage(); applySnapshot(data); });
    socket.on("ticker",   (data) => { markMessage(); applyTicker(data); });
    socket.on("order", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trade.marketState(symbol) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trade.myMarketState(symbol) });
    });
    socket.on("trade", () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trade.marketState(symbol) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trade.myMarketState(symbol) });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setStatus("closed");
    };
  }, [
    symbol,
    isAuthenticated,
    queryClient,
    setStatus,
    setActiveSymbol,
    markMessage,
    resetReconnect,
    incrementReconnect,
  ]);
};
