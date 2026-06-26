import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { queryKeys } from "../api/queryKeys.js";

const getSocketUrl = () =>
  import.meta.env.DEV
    ? window.location.origin
    : (import.meta.env.VITE_TRUSON_API_URL || window.location.origin);

export const useWalletSocket = ({ enabled = false } = {}) => {
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
      socket.emit("join_wallet", { token });
    });

    socket.on("WALLET_UPDATED", () => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet.myWallets });
      qc.invalidateQueries({ queryKey: queryKeys.dashboard.summary });
    });

    socket.on("TRANSACTION_CREATED", () => {
      qc.invalidateQueries({ queryKey: queryKeys.wallet.allTransactions });
      qc.invalidateQueries({ queryKey: queryKeys.wallet.myWallets });
    });

    return () => socket.disconnect();
  }, [enabled, qc]);
};
