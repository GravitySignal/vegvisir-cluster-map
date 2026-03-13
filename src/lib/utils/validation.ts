const STARKNET_ADDRESS_RE = /^0x[0-9a-fA-F]{1,64}$/;

/**
 * Check whether a string is a valid Starknet address (0x + 1-64 hex chars).
 */
export function isValidStarknetAddress(address: string): boolean {
  return STARKNET_ADDRESS_RE.test(address);
}

/**
 * Normalize a Starknet address to lowercase, zero-padded to 66 characters.
 * e.g. "0x1" → "0x0000000000000000000000000000000000000000000000000000000000000001"
 */
export function normalizeAddress(address: string): string {
  const hex = address.slice(2).toLowerCase();
  return `0x${hex.padStart(64, "0")}`;
}
