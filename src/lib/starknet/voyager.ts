import { normalizeAddress } from "@/lib/utils/validation";
import type { TokenHolder, TransferEdge, TokenMetadata } from "@/types";

const API_URL = process.env.VOYAGER_API_URL || "https://api.voyager.online/beta";
const API_KEY = process.env.VOYAGER_API_KEY || "";

interface VoyagerHolderItem {
  holder: string;
  balance: string;
  contractAlias: string | null;
  decimals: string;
  lastTransferTime: number;
}

interface VoyagerHoldersResponse {
  items: VoyagerHolderItem[];
  hasMore: boolean;
  lastPage: number;
}

interface VoyagerTransferItem {
  tokenAddress: string;
  transferFrom: string;
  transferTo: string;
  transferValue: string;
  txHash: string;
  timestamp: number;
  fromAlias: string | null;
  toAlias: string | null;
}

interface VoyagerTransfersResponse {
  items: VoyagerTransferItem[];
  lastPage: number | null;
}

interface VoyagerContractResponse {
  tokenName: string;
  tokenSymbol: string;
  type: string;
  address: string;
  isErcToken: boolean;
  decimals?: string;
}

async function voyagerFetch<T>(path: string, params?: Record<string, string>, retried = false): Promise<T> {
  const base = API_URL.replace(/\/+$/, "");
  const url = new URL(`${base}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      headers: { "x-api-key": API_KEY },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timeout);
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new Error("Request timed out. The token may have too many events to process.");
    }
    throw new Error("Failed to connect to Voyager API. Check your internet connection.");
  } finally {
    clearTimeout(timeout);
  }

  // Rate limit: retry once after 2s
  if (res.status === 429 && !retried) {
    await new Promise((r) => setTimeout(r, 2000));
    return voyagerFetch<T>(path, params, true);
  }

  if (res.status === 429) {
    throw new Error("Rate limited — please try again in a moment.");
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Voyager API error ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function fetchTokenMetadata(contractAddress: string): Promise<TokenMetadata> {
  const data = await voyagerFetch<VoyagerContractResponse>(`/contracts/${contractAddress}`);

  if (!data.isErcToken) {
    throw new Error("This address is not an ERC-20 token contract.");
  }

  return {
    address: contractAddress,
    name: data.tokenName || "Unknown Token",
    symbol: data.tokenSymbol || "???",
    decimals: data.decimals ? parseInt(data.decimals, 10) : 18,
    totalSupply: 0,
  };
}

export async function fetchHolders(
  contractAddress: string,
  limit: number
): Promise<{ holders: TokenHolder[]; totalSupply: number }> {
  const capped = Math.min(limit, 150);
  const holders: TokenHolder[] = [];
  let page = 1;
  const pageSize = 50;

  while (holders.length < capped) {
    const data = await voyagerFetch<VoyagerHoldersResponse>(
      `/tokens/${contractAddress}/holders`,
      { ps: String(pageSize), p: String(page) }
    );

    if (data.items.length === 0) break;

    for (const item of data.items) {
      if (holders.length >= capped) break;
      const balanceFormatted = parseFloat(item.balance);
      if (balanceFormatted <= 0) continue;

      holders.push({
        address: normalizeAddress(item.holder),
        balance: item.balance,
        balanceFormatted,
        percentSupply: 0,
        rank: holders.length + 1,
        alias: item.contractAlias || null,
      });
    }

    if (!data.hasMore) break;
    page++;
  }

  if (holders.length === 0) {
    throw new Error("No holders found for this token. It may be a new or inactive token.");
  }

  const totalSupply = holders.reduce((sum, h) => sum + h.balanceFormatted, 0);
  for (const h of holders) {
    h.percentSupply = totalSupply > 0 ? (h.balanceFormatted / totalSupply) * 100 : 0;
  }

  return { holders, totalSupply };
}

/**
 * Fetch transfers between top holders by querying each holder's transfer history.
 * Uses /contracts/{holder}/transfers which returns pre-decoded transfer records,
 * then filters to only the target token and edges where BOTH endpoints are top holders.
 */
export async function fetchTransfers(
  contractAddress: string,
  holderAddresses: Set<string>,
  _decimals?: number,
  pagesPerHolder: number = 5
): Promise<TransferEdge[]> {
  const edgeMap = new Map<string, { from: string; to: string; volume: number; txCount: number }>();
  const normalizedContract = normalizeAddress(contractAddress);

  function processTransfer(item: VoyagerTransferItem) {
    // Filter to only transfers of this specific token
    const tokenAddr = normalizeAddress(item.tokenAddress);
    if (tokenAddr !== normalizedContract) return;

    const from = normalizeAddress(item.transferFrom);
    const to = normalizeAddress(item.transferTo);

    if (!holderAddresses.has(from) || !holderAddresses.has(to)) return;
    if (from === to) return;

    let volume = 0;
    try {
      volume = parseFloat(item.transferValue);
    } catch {
      return;
    }
    if (isNaN(volume) || volume <= 0) return;

    const key = `${from}:${to}`;
    const existing = edgeMap.get(key);
    if (existing) {
      existing.volume += volume;
      existing.txCount++;
    } else {
      edgeMap.set(key, { from, to, volume, txCount: 1 });
    }
  }

  // Query transfers for each holder in batches to respect rate limits
  const holders = Array.from(holderAddresses);
  const BATCH_SIZE = 5;

  for (let b = 0; b < holders.length; b += BATCH_SIZE) {
    const batch = holders.slice(b, b + BATCH_SIZE);
    const batchPromises = batch.map(async (holderAddr) => {
      for (let page = 1; page <= pagesPerHolder; page++) {
        try {
          const data = await voyagerFetch<VoyagerTransfersResponse>(
            `/contracts/${holderAddr}/transfers`,
            { ps: "50", p: String(page) }
          );

          for (const item of data.items) {
            processTransfer(item);
          }

          // Stop if no more pages
          if (data.items.length < 50 || (data.lastPage !== null && page >= data.lastPage)) break;
        } catch {
          break;
        }
      }
    });

    await Promise.all(batchPromises);
  }

  const edges = Array.from(edgeMap.values())
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 2000);

  return edges;
}
