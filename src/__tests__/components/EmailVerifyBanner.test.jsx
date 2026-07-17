import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const mockRefreshUser = vi.fn();
const mockRequestWithRetry = vi.fn();

vi.mock("../../store/authStore", () => ({
  useAuthStore: vi.fn(),
}));

vi.mock("../../api/client", () => ({
  requestWithRetry: (...args) => mockRequestWithRetry(...args),
}));

import { useAuthStore } from "../../store/authStore";
import EmailVerifyBanner from "../../Components/common/EmailVerifyBanner";

const setupStore = (userOverrides = {}) => {
  // EmailVerifyBanner calls useAuthStore() with NO selector — it destructures
  // the full state object. The mock must handle both the selector and no-arg forms.
  const state = {
    user: {
      email: "alice@example.com",
      emailVerified: false,
      authProvider: "local",
      ...userOverrides,
    },
    refreshUser: mockRefreshUser,
  };
  vi.mocked(useAuthStore).mockImplementation((selector) =>
    typeof selector === "function" ? selector(state) : state,
  );
};

describe("EmailVerifyBanner — visibility rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequestWithRetry.mockResolvedValue({});
    mockRefreshUser.mockResolvedValue(undefined);
  });

  test("renders the banner for an unverified local account", () => {
    setupStore({ emailVerified: false });
    render(<EmailVerifyBanner />);
    expect(screen.getByText(/email not verified/i)).toBeInTheDocument();
  });

  test("renders nothing when user is null", () => {
    const nullState = { user: null, refreshUser: mockRefreshUser };
    vi.mocked(useAuthStore).mockImplementation((selector) =>
      typeof selector === "function" ? selector(nullState) : nullState,
    );
    const { container } = render(<EmailVerifyBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  test("renders nothing when email is already verified", () => {
    setupStore({ emailVerified: true });
    const { container } = render(<EmailVerifyBanner />);
    expect(container).toBeEmptyDOMElement();
  });

  test("renders nothing for Google OAuth users (no verification needed)", () => {
    setupStore({ authProvider: "google", emailVerified: false });
    const { container } = render(<EmailVerifyBanner />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("EmailVerifyBanner — send code flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore({ emailVerified: false });
  });

  test("shows Verify Now button in the initial banner state", () => {
    render(<EmailVerifyBanner />);
    expect(screen.getByText(/verify now/i)).toBeInTheDocument();
  });

  test("transitions to code-entry panel after successful send", async () => {
    mockRequestWithRetry.mockResolvedValue({});
    render(<EmailVerifyBanner />);
    await userEvent.click(screen.getByText(/verify now/i));
    await waitFor(() => {
      expect(screen.getByText(/enter 6-digit code/i)).toBeInTheDocument();
    });
  });

  test("shows error state when send fails", async () => {
    mockRequestWithRetry.mockRejectedValue(new Error("SMTP unavailable"));
    render(<EmailVerifyBanner />);
    await userEvent.click(screen.getByText(/verify now/i));
    await waitFor(() => {
      expect(screen.getByText(/try again/i)).toBeInTheDocument();
    });
  });

  test("Try Again button returns to the banner strip", async () => {
    mockRequestWithRetry.mockRejectedValue(new Error("fail"));
    render(<EmailVerifyBanner />);
    await userEvent.click(screen.getByText(/verify now/i));
    await waitFor(() => screen.getByText(/try again/i));
    await userEvent.click(screen.getByText(/try again/i));
    expect(screen.getByText(/verify now/i)).toBeInTheDocument();
  });
});

describe("EmailVerifyBanner — code verification flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupStore({ emailVerified: false });
    // First call (send code) succeeds; second call (verify code) is controlled per test.
    mockRequestWithRetry.mockResolvedValue({});
  });

  test("Confirm button is disabled until all 6 digits are entered", async () => {
    render(<EmailVerifyBanner />);
    await userEvent.click(screen.getByText(/verify now/i));
    await waitFor(() => screen.getByText(/confirm/i));
    const confirmBtn = screen.getByText(/confirm/i);
    expect(confirmBtn).toBeDisabled();
  });

  test("renders the OTP entry label and a Confirm button in the code panel", async () => {
    mockRequestWithRetry.mockResolvedValueOnce({});
    render(<EmailVerifyBanner />);
    await userEvent.click(screen.getByText(/verify now/i));
    await waitFor(() => {
      expect(screen.getByText(/enter 6-digit code/i)).toBeInTheDocument();
    });
    // Confirm button is present and disabled until a 6-digit code is entered.
    expect(screen.getByText(/confirm/i)).toBeDisabled();
  });
});
