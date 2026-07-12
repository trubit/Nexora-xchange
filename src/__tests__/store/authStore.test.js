import { describe, test, expect, vi, beforeEach } from "vitest";
import { useAuthStore } from "../../store/authStore";

// Mock authService so no real HTTP calls are made.
vi.mock("../../services/authService", () => ({
  authService: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn().mockResolvedValue(undefined),
    google: vi.fn(),
    getMe: vi.fn(),
  },
}));

// Mock the API client used by refreshUser.
vi.mock("../../api/client", () => ({
  requestWithRetry: vi.fn(),
}));

import { authService } from "../../services/authService";
import { requestWithRetry } from "../../api/client";

const MOCK_USER = { id: "user-001", email: "alice@example.com", role: "user", emailVerified: true };
const MOCK_TOKEN = "eyJmYWtlIjoidG9rZW4ifQ.test.signature";

const resetStore = () => {
  localStorage.clear();
  useAuthStore.setState({
    token: "",
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: "",
    successMessage: "",
    needsVerification: false,
  });
};

describe("useAuthStore — initial state", () => {
  beforeEach(resetStore);

  test("starts with no token and no user", () => {
    const { token, user, isAuthenticated } = useAuthStore.getState();
    expect(token).toBe("");
    expect(user).toBeNull();
    expect(isAuthenticated).toBe(false);
  });

  test("starts with no errors or messages", () => {
    const { error, successMessage, needsVerification, isLoading } = useAuthStore.getState();
    expect(error).toBe("");
    expect(successMessage).toBe("");
    expect(needsVerification).toBe(false);
    expect(isLoading).toBe(false);
  });

  test("hydrateSession reads from localStorage", () => {
    localStorage.setItem("token", MOCK_TOKEN);
    localStorage.setItem("user", JSON.stringify(MOCK_USER));
    useAuthStore.getState().hydrateSession();
    expect(useAuthStore.getState().token).toBe(MOCK_TOKEN);
    expect(useAuthStore.getState().user).toEqual(MOCK_USER);
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });
});

describe("useAuthStore — login", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  test("sets token, user, and isAuthenticated on success", async () => {
    vi.mocked(authService.login).mockResolvedValue({ token: MOCK_TOKEN, user: MOCK_USER });

    await useAuthStore.getState().login({ email: MOCK_USER.email, password: "Password1!" });

    const state = useAuthStore.getState();
    expect(state.token).toBe(MOCK_TOKEN);
    expect(state.user).toEqual(MOCK_USER);
    expect(state.isAuthenticated).toBe(true);
    expect(state.isLoading).toBe(false);
    expect(state.successMessage).toBeTruthy();
  });

  test("persists token and user to localStorage on success", async () => {
    vi.mocked(authService.login).mockResolvedValue({ token: MOCK_TOKEN, user: MOCK_USER });

    await useAuthStore.getState().login({ email: MOCK_USER.email, password: "Password1!" });

    expect(localStorage.getItem("token")).toBe(MOCK_TOKEN);
    expect(JSON.parse(localStorage.getItem("user"))).toEqual(MOCK_USER);
  });

  test("sets error message on login failure", async () => {
    vi.mocked(authService.login).mockRejectedValue(new Error("Invalid credentials"));

    await expect(
      useAuthStore.getState().login({ email: "bad@example.com", password: "wrong" }),
    ).rejects.toThrow("Invalid credentials");

    const state = useAuthStore.getState();
    expect(state.error).toBe("Invalid credentials");
    expect(state.isAuthenticated).toBe(false);
    expect(state.isLoading).toBe(false);
  });

  test("sets needsVerification when error mentions email not verified", async () => {
    vi.mocked(authService.login).mockRejectedValue(new Error("Email not verified. Check your inbox."));

    await expect(
      useAuthStore.getState().login({ email: "unverified@example.com", password: "pass" }),
    ).rejects.toThrow();

    expect(useAuthStore.getState().needsVerification).toBe(true);
  });

  test("throws when server returns missing token", async () => {
    vi.mocked(authService.login).mockResolvedValue({ user: MOCK_USER }); // no token

    await expect(
      useAuthStore.getState().login({ email: MOCK_USER.email, password: "pass" }),
    ).rejects.toThrow();
  });
});

describe("useAuthStore — logout", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
    localStorage.setItem("token", MOCK_TOKEN);
    localStorage.setItem("user", JSON.stringify(MOCK_USER));
    useAuthStore.setState({ token: MOCK_TOKEN, user: MOCK_USER, isAuthenticated: true });
  });

  test("clears token, user, and isAuthenticated", async () => {
    vi.mocked(authService.logout).mockResolvedValue(undefined);
    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.token).toBe("");
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  test("removes token and user from localStorage", async () => {
    vi.mocked(authService.logout).mockResolvedValue(undefined);
    await useAuthStore.getState().logout();

    expect(localStorage.getItem("token")).toBeNull();
    expect(localStorage.getItem("user")).toBeNull();
  });

  test("still clears local state even when server logout call fails", async () => {
    vi.mocked(authService.logout).mockRejectedValue(new Error("Network error"));
    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(localStorage.getItem("token")).toBeNull();
  });
});

describe("useAuthStore — clearAuthMessages", () => {
  beforeEach(resetStore);

  test("resets error, successMessage, and needsVerification", () => {
    useAuthStore.setState({ error: "Some error", successMessage: "Done!", needsVerification: true });
    useAuthStore.getState().clearAuthMessages();

    const state = useAuthStore.getState();
    expect(state.error).toBe("");
    expect(state.successMessage).toBe("");
    expect(state.needsVerification).toBe(false);
  });
});

describe("useAuthStore — setGoogleSession", () => {
  beforeEach(resetStore);

  test("stores google session token and user", () => {
    useAuthStore.getState().setGoogleSession({ token: MOCK_TOKEN, user: MOCK_USER });

    const state = useAuthStore.getState();
    expect(state.token).toBe(MOCK_TOKEN);
    expect(state.user).toEqual(MOCK_USER);
    expect(state.isAuthenticated).toBe(true);
    expect(state.successMessage).toContain("Google");
  });
});

describe("useAuthStore — refreshUser", () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  test("updates user state when server returns fresh user data", async () => {
    localStorage.setItem("token", MOCK_TOKEN);
    useAuthStore.setState({ token: MOCK_TOKEN, user: MOCK_USER });
    const freshUser = { ...MOCK_USER, emailVerified: true };
    vi.mocked(requestWithRetry).mockResolvedValue({ user: freshUser });

    await useAuthStore.getState().refreshUser();

    expect(useAuthStore.getState().user).toEqual(freshUser);
  });

  test("does nothing when no token is in localStorage", async () => {
    await useAuthStore.getState().refreshUser();
    expect(requestWithRetry).not.toHaveBeenCalled();
  });
});
