import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";

const getSocketUrl = () =>
  import.meta.env.DEV
    ? window.location.origin
    : (import.meta.env.VITE_TRUSON_API_URL || window.location.origin);

export const useDashboardSocket = ({ enabled = true } = {}) => {
  const [status, setStatus] = useState("idle");
  const socketRef = useRef(null);

  useEffect(() => {
    if (!enabled) {
      setStatus("idle");
      return;
    }

    setStatus("connecting");

    const socket = io(getSocketUrl(), {
      transports: ["polling", "websocket"],
      reconnection: true,
    });
    socketRef.current = socket;

    socket.on("connect",       () => setStatus("connected"));
    socket.on("disconnect",    () => setStatus("disconnected"));
    socket.on("connect_error", () => setStatus("disconnected"));
    socket.on("reconnecting",  () => setStatus("connecting"));
    socket.on("reconnect",     () => setStatus("connected"));

    return () => {
      socket.disconnect();
      socketRef.current = null;
      setStatus("idle");
    };
  }, [enabled]);

  return status;
};
