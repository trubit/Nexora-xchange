import { httpClient } from "./httpClient";

export const authService = {
  register: async (payload) => {
    const { data } = await httpClient.post("/api/auth/register", payload);
    return data;
  },
  login: async (payload) => {
    const { data } = await httpClient.post("/api/auth/login", payload);
    return data;
  },
  google: async (payload) => {
    const { data } = await httpClient.post("/api/auth/google", payload);
    return data;
  },
  forgotPassword: async (email) => {
    const { data } = await httpClient.post("/api/auth/forgot-password", { email });
    return data;
  },
  resetPassword: async (payload) => {
    const { data } = await httpClient.post("/api/auth/reset-password", payload);
    return data;
  },
  verifyEmail: async (code) => {
    const { data } = await httpClient.post("/api/auth/verify-email", { code });
    return data;
  },
  resendEmailVerification: async (email) => {
    const { data } = await httpClient.post("/api/auth/verify-email/resend", { email });
    return data;
  },
  getMe: async () => {
    const { data } = await httpClient.get("/api/auth/me");
    return data;
  },
  exchangeOAuthCode: async (code) => {
    const { data } = await httpClient.get(`/api/auth/oauth/token?code=${encodeURIComponent(code)}`);
    return data;
  },
  logout: async () => {
    const { data } = await httpClient.post("/api/auth/logout");
    return data;
  },
};
