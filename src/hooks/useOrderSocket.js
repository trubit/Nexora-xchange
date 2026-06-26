import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { queryKeys } from "../api/queryKeys.js";

const getSocketUrl = () =>
  import.meta.env.DEV
    ? window.location.origin
    : (import.meta.env.VITE_TRUSON_API_URL || window.location.origin);

export const useOrderSocket = ({ enabled = false } = {}) => {
  const qc = useQueryClient();

  useEffect(() => {
    if (!enabled) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = io(getSocketUrl(), {
      transports: ["polling", "websocket"],
      reconnectionDelay: 2000,
      reconnectionAttempts: 5,
    });

    socket.on("connect", () => {
      socket.emit("join_orders", { token });
    });

    socket.on("ORDER_CREATED", (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.orders.open({}) });
      qc.invalidateQueries({ queryKey: queryKeys.wallet.myWallets });
      // Invalidate market state so order book reflects the new order.
      const symbol = data?.order?.symbol;
      if (symbol) {
        qc.invalidateQueries({ queryKey: queryKeys.trade.myMarketState(symbol) });
      }
    });

    socket.on("ORDER_CANCELLED", (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.orders.open({}) });
      qc.invalidateQueries({ queryKey: queryKeys.orders.history({}) });
      qc.invalidateQueries({ queryKey: queryKeys.wallet.myWallets });
      const symbol = data?.order?.symbol;
      if (symbol) {
        qc.invalidateQueries({ queryKey: queryKeys.trade.myMarketState(symbol) });
      }
    });

    socket.on("ORDER_UPDATED", (data) => {
      qc.invalidateQueries({ queryKey: queryKeys.orders.open({}) });
      qc.invalidateQueries({ queryKey: queryKeys.orders.history({}) });
      const symbol = data?.order?.symbol;
      if (symbol) {
        qc.invalidateQueries({ queryKey: queryKeys.trade.myMarketState(symbol) });
      }
    });

    return () => socket.disconnect();
  }, [enabled, qc]);
};
