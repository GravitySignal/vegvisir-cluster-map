import { normalizeAddress } from "@/lib/utils/validation";

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Truncate a hex address to show prefix and suffix.
 * e.g. "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d"
 *    → "0x0471...938d"
 */
export function truncateAddress(address: string, chars = 4): string {
  if (!address || address.length <= 2 + chars * 2) return address;
  return `${address.slice(0, 2 + chars)}...${address.slice(-chars)}`;
}

export function isZeroAddress(address: string): boolean {
  try {
    return normalizeAddress(address) === ZERO_ADDRESS;
  } catch {
    return false;
  }
}

/**
 * Format address for labels/tooltips while avoiding misleading all-zero truncations.
 */
export function formatAddressLabel(address: string, chars = 4): string {
  if (!address) return address;
  if (isZeroAddress(address)) return "Zero Address";

  const normalized = normalizeAddress(address);
  const basic = truncateAddress(normalized, chars);

  // Some non-zero addresses can still look like 0x0000...0000 after truncation.
  // Include a center slice in that case.
  if (/^0x0+\.\.\.0+$/i.test(basic)) {
    const centerStart = 2 + Math.floor((normalized.length - 2) / 2) - 2;
    const center = normalized.slice(centerStart, centerStart + 4);
    return `${normalized.slice(0, 2 + chars)}...${center}...${normalized.slice(-chars)}`;
  }

  return basic;
}

/**
 * Format a numeric balance for display.
 * e.g. 1234567.891 → "1,234,567.89"
 */
export function formatBalance(balance: number, decimals = 2): string {
  return balance.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/**
 * Format a percentage value for display.
 * e.g. 12.3456 → "12.35%"
 */
export function formatPercent(pct: number): string {
  return `${pct.toFixed(2)}%`;
}
