import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TokenInput from "../TokenInput";

const STRK_ADDRESS =
  "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
const ETH_ADDRESS =
  "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7";

describe("TokenInput", () => {
  it("renders address mode by default", () => {
    render(<TokenInput onSubmit={vi.fn()} isLoading={false} />);
    expect(
      screen.getByPlaceholderText("Enter Starknet address (wallet/app/contract)")
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Address graph" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Token holder map" })).toBeInTheDocument();
  });

  it("renders max connections input with default value 80", () => {
    render(<TokenInput onSubmit={vi.fn()} isLoading={false} />);
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveValue(80);
  });

  it("renders max input with min=10 and max=150", () => {
    render(<TokenInput onSubmit={vi.fn()} isLoading={false} />);
    const input = screen.getByRole("spinbutton");
    expect(input).toHaveAttribute("min", "10");
    expect(input).toHaveAttribute("max", "150");
  });

  it("renders Analyze button", () => {
    render(<TokenInput onSubmit={vi.fn()} isLoading={false} />);
    expect(screen.getByRole("button", { name: "Analyze" })).toBeInTheDocument();
  });

  it("disables submit button when isLoading is true", () => {
    render(<TokenInput onSubmit={vi.fn()} isLoading={true} />);
    expect(screen.getByRole("button", { name: "Loading..." })).toBeDisabled();
  });

  it("hides quick-select buttons in address mode", () => {
    render(<TokenInput onSubmit={vi.fn()} isLoading={false} />);
    expect(screen.queryByText(/Quick select:/)).not.toBeInTheDocument();
  });

  it("shows quick-select buttons in token mode", async () => {
    const user = userEvent.setup();
    render(<TokenInput onSubmit={vi.fn()} isLoading={false} />);
    await user.click(screen.getByRole("button", { name: "Token holder map" }));
    expect(screen.getByText(/Quick select:/)).toBeInTheDocument();
    expect(screen.getByText(/STRK/)).toBeInTheDocument();
    expect(screen.getByText(/ETH/)).toBeInTheDocument();
  });

  it("shows validation error for empty address on submit", async () => {
    const onSubmit = vi.fn();
    render(<TokenInput onSubmit={onSubmit} isLoading={false} />);
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect(screen.getByText(/please enter a starknet address/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("shows validation error for invalid address on submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TokenInput onSubmit={onSubmit} isLoading={false} />);
    await user.type(
      screen.getByPlaceholderText("Enter Starknet address (wallet/app/contract)"),
      "not-an-address"
    );
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    expect(screen.getByText(/invalid starknet address/i)).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("calls onSubmit with valid address in address mode", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TokenInput onSubmit={onSubmit} isLoading={false} />);
    await user.type(
      screen.getByPlaceholderText("Enter Starknet address (wallet/app/contract)"),
      STRK_ADDRESS
    );
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    expect(onSubmit).toHaveBeenCalledWith(STRK_ADDRESS, 80, "address");
  });

  it("calls onSubmit with token mode after switching tabs", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TokenInput onSubmit={onSubmit} isLoading={false} />);
    await user.click(screen.getByRole("button", { name: "Token holder map" }));
    await user.type(
      screen.getByPlaceholderText("Enter token contract address (ERC-20)"),
      STRK_ADDRESS
    );
    await user.click(screen.getByRole("button", { name: "Analyze" }));
    expect(onSubmit).toHaveBeenCalledWith(STRK_ADDRESS, 80, "token");
  });

  it("quick-select STRK triggers token mode submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TokenInput onSubmit={onSubmit} isLoading={false} />);
    await user.click(screen.getByRole("button", { name: "Token holder map" }));
    await user.click(screen.getByText(/STRK/));
    expect(onSubmit).toHaveBeenCalledWith(STRK_ADDRESS, 80, "token");
  });

  it("quick-select ETH triggers token mode submit", async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();
    render(<TokenInput onSubmit={onSubmit} isLoading={false} />);
    await user.click(screen.getByRole("button", { name: "Token holder map" }));
    await user.click(screen.getByText(/ETH/));
    expect(onSubmit).toHaveBeenCalledWith(ETH_ADDRESS, 80, "token");
  });
});
