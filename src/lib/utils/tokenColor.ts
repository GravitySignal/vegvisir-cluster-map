import { normalizeAddress } from "@/lib/utils/validation";

const KNOWN_BY_SYMBOL: Record<string, string> = {
  ETH: "#2563eb",
  STRK: "#7c3aed",
  USDC: "#1e3a8a",
  LORDS: "#ca8a04",
};

const KNOWN_BY_ADDRESS: Record<string, string> = {
  [normalizeAddress("0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7")]: "#2563eb",
  [normalizeAddress("0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d")]: "#7c3aed",
};

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

export function getTokenColor(tokenAddress?: string, tokenSymbol?: string | null): string {
  const symbol = (tokenSymbol || "").toUpperCase().trim();
  if (symbol && KNOWN_BY_SYMBOL[symbol]) {
    return KNOWN_BY_SYMBOL[symbol];
  }

  if (tokenAddress) {
    const normalized = normalizeAddress(tokenAddress);
    if (KNOWN_BY_ADDRESS[normalized]) {
      return KNOWN_BY_ADDRESS[normalized];
    }
    const hash = hashString(normalized);
    const hue = hash % 360;
    return `hsl(${hue} 70% 48%)`;
  }

  return "#64748b";
}
