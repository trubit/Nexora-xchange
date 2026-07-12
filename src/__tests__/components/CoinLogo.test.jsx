import { describe, test, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import CoinLogo from "../../Components/common/CoinLogo";

const mockUseCoinLogos = vi.fn();

vi.mock("../../hooks/queries/useCoinLogos", () => ({
  useCoinLogos: () => mockUseCoinLogos(),
}));

describe("CoinLogo", () => {
  beforeEach(() => {
    // Default: no server-uploaded logos; the CDN is the only source.
    mockUseCoinLogos.mockReturnValue({ data: {} });
  });

  test("renders an img element for a known symbol", () => {
    render(<CoinLogo symbol="BTC" />);
    const img = screen.getByRole("img", { name: "BTC" });
    expect(img).toBeInTheDocument();
  });

  test("img src uses the CDN URL for the given symbol", () => {
    render(<CoinLogo symbol="ETH" />);
    const img = screen.getByRole("img", { name: "ETH" });
    expect(img.src).toContain("eth");
  });

  test("renders the letter-badge fallback after all image sources fail", () => {
    render(<CoinLogo symbol="UNKN" />);
    const img = screen.queryByRole("img");
    // Trigger error on the CDN image (the only source for an unknown symbol).
    if (img) fireEvent.error(img);
    // Should now render the letter badge.
    expect(screen.getByText("UNKN")).toBeInTheDocument();
  });

  test("letter badge shows first 4 characters of the symbol", () => {
    render(<CoinLogo symbol="LONGSYM" />);
    const img = screen.queryByRole("img");
    if (img) fireEvent.error(img);
    expect(screen.getByText("LONG")).toBeInTheDocument();
  });

  test("prefers the server-uploaded logo over the CDN", () => {
    mockUseCoinLogos.mockReturnValue({ data: { BTC: "/uploads/coins/btc-custom.png" } });
    render(<CoinLogo symbol="BTC" />);
    const img = screen.getByRole("img", { name: "BTC" });
    expect(img.src).toContain("/uploads/coins/btc-custom.png");
  });

  test("strips localhost origin from uploaded logo URL", () => {
    mockUseCoinLogos.mockReturnValue({
      data: { ETH: "http://localhost:5001/uploads/coins/eth.png" },
    });
    render(<CoinLogo symbol="ETH" />);
    const img = screen.getByRole("img", { name: "ETH" });
    // Use getAttribute("src") — jsdom resolves relative paths to absolute URLs
    // in img.src, so we must read the raw attribute to check the component output.
    const rawSrc = img.getAttribute("src");
    expect(rawSrc).toBe("/uploads/coins/eth.png");
  });

  test("falls back to CDN after the uploaded logo fails", () => {
    mockUseCoinLogos.mockReturnValue({ data: { BTC: "/uploads/coins/btc-bad.png" } });
    render(<CoinLogo symbol="BTC" />);
    const img = screen.getByRole("img", { name: "BTC" });
    // First image is the uploaded logo — fire error to trigger fallback.
    fireEvent.error(img);
    const updatedImg = screen.getByRole("img", { name: "BTC" });
    expect(updatedImg.src).toContain("btc");
    expect(updatedImg.src).toContain("cdn");
  });

  test("applies the given size to the img element", () => {
    render(<CoinLogo symbol="BTC" size={48} />);
    const img = screen.getByRole("img", { name: "BTC" });
    expect(img.style.width).toBe("48px");
    expect(img.style.height).toBe("48px");
  });

  test("renders with default size of 36 when size prop is omitted", () => {
    render(<CoinLogo symbol="ETH" />);
    const img = screen.getByRole("img", { name: "ETH" });
    expect(img.style.width).toBe("36px");
  });

  test("normalises the symbol to uppercase", () => {
    render(<CoinLogo symbol="btc" />);
    const img = screen.getByRole("img", { name: "BTC" });
    expect(img).toBeInTheDocument();
  });

  test("renders '?' badge when symbol is empty", () => {
    render(<CoinLogo symbol="" />);
    const img = screen.queryByRole("img");
    if (img) fireEvent.error(img);
    // Falls back to '?' badge
    expect(screen.getByText("?")).toBeInTheDocument();
  });
});
