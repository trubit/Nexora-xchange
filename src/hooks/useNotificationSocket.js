import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { io } from "socket.io-client";
import { useAuthStore } from "../store/authStore.js";
import { useNotificationStore } from "../store/notificationStore.js";
import { queryKeys } from "../api/queryKeys.js";

const getSocketUrl = () =>
  import.meta.env.DEV
    ? window.location.origin
    : (import.meta.env.VITE_TRUSON_API_URL || window.location.origin);

export const useNotificationSocket = ({ enabled = true } = {}) => {
  const qc   = useQueryClient();
  const user = useAuthStore((s) => s.user);

  useEffect(() => {
    if (!enabled || !user?._id) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    const socket = io(getSocketUrl(), {
      transports: ["polling", "websocket"],
      reconnectionDelay:    2000,
      reconnectionAttempts: 10,
    });

    socket.on("connect", () => {
      socket.emit("join_notifications", { token });
    });

    socket.on("NOTIFICATION", (notification) => {
      useNotificationStore.getState().addNotification(notification);
      qc.invalidateQueries({ queryKey: queryKeys.notifications.unreadCount });
      qc.invalidateQueries({ queryKey: ["notifications", "list"] });
    });

    return () => socket.disconnect();
  }, [enabled, user?._id, qc]);
};
