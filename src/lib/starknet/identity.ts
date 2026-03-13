import { normalizeAddress } from "@/lib/utils/validation";

const CARTRIDGE_API = "https://api.cartridge.gg/query";
const STARKNET_ID_API = "https://api.starknet.id";

interface IdentityInfo {
  starkDomain?: string;
  cartridgeUsername?: string;
}

function toMinimalAddress(address: string): string {
  const normalized = normalizeAddress(address);
  const compact = normalized.slice(2).replace(/^0+/, "");
  return `0x${compact || "0"}`;
}

function normalizeDomainResponse(text: string): string | null {
  const trimmed = text.trim();
  if (!trimmed || trimmed.toLowerCase().includes("no data")) return null;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed) as
        | { domain?: string }
        | { domains?: string[] };
      if ("domain" in parsed && typeof parsed.domain === "string") {
        return parsed.domain.trim() || null;
      }
      if ("domains" in parsed && Array.isArray(parsed.domains)) {
        return parsed.domains[0] || null;
      }
    } catch {
      return null;
    }
  }
  return trimmed;
}

async function fetchStarkDomain(address: string): Promise<string | null> {
  const minimal = toMinimalAddress(address);
  try {
    const res = await fetch(
      `${STARKNET_ID_API}/addr_to_domain?addr=${encodeURIComponent(minimal)}`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!res.ok) return null;
    const body = await res.text();
    return normalizeDomainResponse(body);
  } catch {
    return null;
  }
}

async function fetchCartridgeUsernames(addresses: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (addresses.length === 0) return result;

  const minimalAddresses = Array.from(
    new Set(addresses.map((address) => toMinimalAddress(address)))
  );

  try {
    const payload = {
      query:
        "query($addresses:[String!]) { controllers(first: 250, where: { addressIn: $addresses }) { edges { node { address account { username } } } } }",
      variables: {
        addresses: minimalAddresses,
      },
    };
    const res = await fetch(CARTRIDGE_API, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(12000),
    });
    if (!res.ok) return result;
    const data = (await res.json()) as {
      data?: {
        controllers?: {
          edges?: Array<{
            node?: {
              address?: string;
              account?: { username?: string | null } | null;
            };
          }>;
        };
      };
    };

    const edges = data.data?.controllers?.edges || [];
    for (const edge of edges) {
      const addr = edge.node?.address;
      const username = edge.node?.account?.username;
      if (!addr || !username) continue;
      const normalized = normalizeAddress(addr);
      if (username.trim()) {
        result.set(normalized, username.trim());
      }
    }
    return result;
  } catch {
    return result;
  }
}

export async function fetchIdentityInfo(
  addresses: string[]
): Promise<Map<string, IdentityInfo>> {
  const unique = Array.from(
    new Set(addresses.map((address) => normalizeAddress(address)))
  ).slice(0, 140);
  const infoMap = new Map<string, IdentityInfo>();
  if (unique.length === 0) return infoMap;

  const cartridgeMap = await fetchCartridgeUsernames(unique);
  for (const [address, username] of cartridgeMap.entries()) {
    infoMap.set(address, {
      ...(infoMap.get(address) || {}),
      cartridgeUsername: username,
    });
  }

  const DOMAIN_CONCURRENCY = 12;
  for (let i = 0; i < unique.length; i += DOMAIN_CONCURRENCY) {
    const batch = unique.slice(i, i + DOMAIN_CONCURRENCY);
    const domains = await Promise.all(batch.map((address) => fetchStarkDomain(address)));
    for (let index = 0; index < batch.length; index++) {
      const domain = domains[index];
      if (!domain) continue;
      const address = batch[index];
      infoMap.set(address, {
        ...(infoMap.get(address) || {}),
        starkDomain: domain,
      });
    }
  }

  return infoMap;
}
