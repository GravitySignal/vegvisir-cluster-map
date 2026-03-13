import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TokenInput from "../TokenInput";

const STRK_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const ETH_ADDRESS =
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

describe("TokenInput", () => {
  it("renders address input with placeholder", () => {
    render(<TokenInput onSubmit={vi.fn()} isLoading={false} />);
    expect(
      screen.getByPlaceholderText("Enter token contract address (0x...)")
    ).toBeInTheDocument();
  });

  it("renders max holders input with default value 100", () => {
    render(<TokenInput onSubmit={vi.fn()} isLoading={false} />);
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveValue(100);
  });

  it("renders max holders input with min=10 and max=150", () => {
    render(<TokenInput onSubmit={vi.fn()} isLoading={false} />);
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveAttribute("min", "10");
    expect(input).toHaveAttribute("max", "150");
  });

  it("renders Load Map button", () => {
    render(<TokenInput onSubmit={vi.fn()} isLoading={false} />);
    expect(screen.getByRole("button", { name: "Load Map" })).toBeInTheDocument();
  });

  it("disables submit button when isLoading is true", () => {
    render(<TokenInput onSubmit={vi.fn()} isLoading={true} />);
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
  });

  it("shows Loading... text when isLoading is true", () => {
    render(<TokenInput onSubmit={vi.fn()} isLoading={true} />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("renders quick-select buttons for STRK and ETH", () => {
    render(<TokenInput onSubmit={vi.fn()} isLoading={false} />);
    expect(screen.getByText(/STRK/)).toBeInTheDocument();
    expect(screen.getByText(/ETH/)).toBeInTheDocument();
  });

  it("shows truncated addresses on quick-select buttons", () => {
    render(<TokenInput onSubmit={vi.fn()} isLoading={false} />);
    // truncateAddress with default chars=4 → "0x0471...938d"
    expect(screen.getByText(/0x0471…938d|0x0471\.\.\.938d/)).toBeInTheDocument();
  });

  it("shows validation error for empty address on submit", async () => {
    const onSubmit = vi.fn();
    render(<TokenInput onSubmit={onSubmit} isLoading={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Load Map" }));
    expect(screen.getByText(/enter a token/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows validation error for invalid address on submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TokenInput onSubmit={onSubmit} isLoading={false} />);
    await user.type(
      screen.getByPlaceholderText("Enter token contract address (0x...)"),
      "not-an-address"
    );
    await user.click(screen.getByRole("button", { name: "Load Map" }));
    expect(screen.getByText(/invalid starknet address/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with valid address and limit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TokenInput onSubmit={onSubmit} isLoading={false} />);
    await user.type(
      screen.getByPlaceholderText("Enter token contract address (0x...)"),
      STRK_ADDRESS
    );
    await user.click(screen.getByRole("button", { name: "Load Map" }));
    expect(onSubmit).toHaveBeenCalledWith(STRK_ADDRESS, 100);
  });

  it("clears error when user types in address input", async () => {
    const user = userEvent.setup();
    render(<TokenInput onSubmit={vi.fn()} isLoading={false} />);
    // Trigger error first
    await user.click(screen.getByRole("button", { name: "Load Map" }));
    expect(screen.getByText(/enter a token/i)).toBeInTheDocument();
    // Now type — error should clear
    await user.type(
      screen.getByPlaceholderText("Enter token contract address (0x...)"),
      "0"
    );
    expect(screen.queryByText(/enter a token/i)).not.toBeInTheDocument();
  });

  it("quick-select STRK fills address and calls onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TokenInput onSubmit={onSubmit} isLoading={false} />);
    await user.click(screen.getByText(/STRK/));
    expect(onSubmit).toHaveBeenCalledWith(STRK_ADDRESS, 100);
  });

  it("quick-select ETH fills address and calls onSubmit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TokenInput onSubmit={onSubmit} isLoading={false} />);
    await user.click(screen.getByText(/ETH/));
    expect(onSubmit).toHaveBeenCalledWith(ETH_ADDRESS, 100);
  });
});
