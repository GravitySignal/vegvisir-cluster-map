import { describe, it, expect } from "vitest";
import { truncateAddress, formatBalance, formatPercent } from "../utils/format";
import { isValidStarknetAddress, normalizeAddress } from "../utils/validation";

describe("truncateAddress", () => {
  it("truncates a long address", () => {
    expect(
      truncateAddress(
        "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
      )
    ).toBe("0x0471...938d");
  });

  it("respects custom chars parameter", () => {
    expect(
      truncateAddress(
        "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d",
        6
      )
    ).toBe("0x04718f...7c938d");
  });

  it("returns short addresses unchanged", () => {
    expect(truncateAddress("0x1234")).toBe("0x1234");
  });

  it("handles empty string", () => {
    expect(truncateAddress("")).toBe("");
  });
});

describe("formatBalance", () => {
  it("formats with default 2 decimals", () => {
    expect(formatBalance(1234567.891)).toBe("1,234,567.89");
  });

  it("formats with custom decimals", () => {
    expect(formatBalance(1234.5, 0)).toBe("1,235");
  });

  it("formats zero", () => {
    expect(formatBalance(0)).toBe("0.00");
  });
});

describe("formatPercent", () => {
  it("formats a percentage", () => {
    expect(formatPercent(12.3456)).toBe("12.35%");
  });

  it("formats zero", () => {
    expect(formatPercent(0)).toBe("0.00%");
  });

  it("formats 100", () => {
    expect(formatPercent(100)).toBe("100.00%");
  });
});

describe("isValidStarknetAddress", () => {
  it("accepts minimal address 0x1", () => {
    expect(isValidStarknetAddress("0x1")).toBe(true);
  });

  it("accepts full-length address", () => {
    expect(
      isValidStarknetAddress(
        "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
      )
    ).toBe(true);
  });

  it("rejects bare 0x", () => {
    expect(isValidStarknetAddress("0x")).toBe(false);
  });

  it("rejects missing 0x prefix", () => {
    expect(isValidStarknetAddress("04718f5a")).toBe(false);
  });

  it("rejects non-hex characters", () => {
    expect(isValidStarknetAddress("0xGHIJKL")).toBe(false);
  });

  it("rejects address longer than 66 chars (0x + 64 hex)", () => {
    expect(
      isValidStarknetAddress("0x" + "a".repeat(65))
    ).toBe(false);
  });
});

describe("normalizeAddress", () => {
  it("zero-pads short address to 66 chars", () => {
    const result = normalizeAddress("0x1");
    expect(result).toBe(
      "0x0000000000000000000000000000000000000000000000000000000000000001"
    );
    expect(result.length).toBe(66);
  });

  it("lowercases mixed-case address", () => {
    expect(normalizeAddress("0xABCDEF")).toBe(
      "0x0000000000000000000000000000000000000000000000000000000000abcdef"
    );
  });

  it("preserves already-normalized address", () => {
    const addr =
      "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d";
    expect(normalizeAddress(addr)).toBe(addr);
  });
});
