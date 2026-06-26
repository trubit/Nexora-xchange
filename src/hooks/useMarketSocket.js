import { useEffect, useRef } from "react";
import { io } from "socket.io-client";
import { useLiveMarketStore } from "../store/liveMarketStore.js";

const getSocketUrl = () =>
  import.meta.env.DEV
    ? window.location.origin
    : (import.meta.env.VITE_TRUSON_API_URL || window.location.origin);

/**
 * Connects to the main Socket.IO server, joins "market-updates" room,
 * and streams all live ticker events into the liveMarketStore.
 * Mount this hook once in the Markets page.
 */
export const useMarketSocket = () => {
  const socketRef    = useRef(null);
  const setTicker    = useLiveMarketStore((s) => s.setTicker);
  const setConnected = useLiveMarketStore((s) => s.setConnected);

  useEffect(() => {
    const socket = io(getSocketUrl(), {
      transports: ["polling", "websocket"],
      reconnection: true,
      reconnectionDelay: 1_000,
      reconnectionDelayMax: 15_000,
    });
    socketRef.current = socket;

    const onConnect = () => {
      setConnected(true);
      socket.emit("join_market_updates");
    };

    const onDisconnect = () => setConnected(false);

    const onTicker = (data) => {
      if (data?.symbol) setTicker(data.symbol, data);
    };

    socket.on("connect",      onConnect);
    socket.on("disconnect",   onDisconnect);
    socket.on("reconnect",    onConnect);
    socket.on("ticker-update", onTicker);

    return () => {
      socket.off("connect",       onConnect);
      socket.off("disconnect",    onDisconnect);
      socket.off("reconnect",     onConnect);
      socket.off("ticker-update", onTicker);
      socket.disconnect();
      socketRef.current = null;
      setConnected(false);
    };
  }, [setTicker, setConnected]);
};
