import { create } from "zustand";
import { authService } from "../services/authService";
import { requestWithRetry } from "../api/client";

const getStoredUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const hasSession = () => Boolean(localStorage.getItem("token") && getStoredUser());

export const useAuthStore = create((set, get) => {
  // Listen for the API client's session-expired signal (JWT invalid, no refresh token).
  // Force logout so the user is sent to the login page instead of hanging in a broken state.
  if (typeof window !== "undefined") {
    window.addEventListener("auth:session-expired", () => {
      get().logout();
      // Only redirect if the user is on a protected route (not already on login/signup/public pages).
      const publicPaths = ["/login", "/signup", "/forgot-password", "/reset-password", "/verify-email"];
      const onPublicPage = publicPaths.some((p) => window.location.pathname.startsWith(p));
      if (!onPublicPage) {
        window.location.href = "/login";
      }
    });
  }

  return {
  token: localStorage.getItem("token") || "",
  user: getStoredUser(),
  isAuthenticated: hasSession(),
  isLoading: false,
  error: "",
  successMessage: "",
  needsVerification: false,

  hydrateSession: () => {
    set({
      token: localStorage.getItem("token") || "",
      user: getStoredUser(),
      isAuthenticated: hasSession(),
    });
  },

  login: async ({ email, password }) => {
    set({
      isLoading: true,
      error: "",
      successMessage: "",
      needsVerification: false,
    });
    try {
      const payload = await authService.login({ email, password });
      if (!payload?.token || !payload?.user) {
        throw new Error("Invalid server response. Please try again.");
      }
      localStorage.setItem("token", payload.token);
      localStorage.setItem("user", JSON.stringify(payload.user));
      set({
        token: payload.token,
        user: payload.user,
        isAuthenticated: true,
        successMessage: "Login successful!",
        isLoading: false,
      });
      return payload;
    } catch (error) {
      const message = error.message || "Login failed.";
      set({
        error: message,
        needsVerification: message.toLowerCase().includes("email not verified"),
        isLoading: false,
      });
      throw error;
    }
  },

  register: async ({ email, password, referralId }) => {
    set({ isLoading: true, error: "", successMessage: "" });
    try {
      const payload = await authService.register({
        email,
        password,
        referralId: referralId?.trim() || undefined,
      });
      set({
        successMessage: payload.message || "Registration successful!",
        isLoading: false,
      });
      return payload;
    } catch (error) {
      set({ error: error.message || "Registration failed.", isLoading: false });
      throw error;
    }
  },

  setGoogleSession: (payload) => {
    localStorage.setItem("token", payload.token);
    localStorage.setItem("user", JSON.stringify(payload.user));
    set({
      token: payload.token,
      user: payload.user,
      isAuthenticated: true,
      error: "",
      successMessage: "Signed in with Google.",
    });
  },

  logout: async () => {
    // Tell the server to blacklist the current token before clearing local state.
    // Fire-and-forget — even if the request fails, local session is still cleared.
    authService.logout().catch(() => {});
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    set({
      token: "",
      user: null,
      isAuthenticated: false,
      error: "",
      successMessage: "",
      needsVerification: false,
    });
  },

  clearAuthMessages: () => {
    set({ error: "", successMessage: "", needsVerification: false });
  },

  refreshUser: async () => {
    if (!localStorage.getItem("token")) return;
    try {
      const data = await requestWithRetry({ method: "get", url: "/api/auth/me" });
      const freshUser = data?.user;
      if (!freshUser) return;
      localStorage.setItem("user", JSON.stringify(freshUser));
      set({ user: freshUser });
    } catch {
      // silently ignore — stale data is better than crashing
    }
  },
  };
});
