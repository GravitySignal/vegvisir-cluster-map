import {
  type AddressTransfer,
  fetchAddressProfiles,
  fetchAddressTransfers,
  fetchHolders,
  fetchTokenMetadata,
  fetchTransfers,
} from "@/lib/starknet/voyager";
import { getCached, setCache } from "@/lib/starknet/cache";
import { classifyEntity } from "@/lib/starknet/entityClassification";
import { fetchIdentityInfo } from "@/lib/starknet/identity";
import { getTokenColor } from "@/lib/utils/tokenColor";
import { normalizeAddress } from "@/lib/utils/validation";
import type { EntityType, GraphData, TokenHolder, TransferEdge } from "@/types";

interface PeerAggregate {
  address: string;
  alias: string | null;
  incomingVolume: number;
  outgoingVolume: number;
  incomingTxCount: number;
  outgoingTxCount: number;
  incomingTokens: Map<string, number>;
  outgoingTokens: Map<string, number>;
}

interface AddressGraphOptions {
  depth: number;
  maxTransfersPerAddress: number;
}

const ZERO_ADDRESS =
  "0x0000000000000000000000000000000000000000000000000000000000000000";

function selectDisplayAlias(
  preferred: string | null,
  starkDomain?: string | null,
  cartridgeUsername?: string | null
): string | null {
  if (preferred) return preferred;
  if (starkDomain) return starkDomain;
  if (cartridgeUsername) return `@${cartridgeUsername}`;
  return null;
}

function increment(map: Map<string, number>, key: string, amount: number): void {
  map.set(key, (map.get(key) || 0) + amount);
}

function dominantKey(map: Map<string, number>): string | null {
  let best: string | null = null;
  let bestValue = -1;
  for (const [key, value] of map.entries()) {
    if (value > bestValue) {
      best = key;
      bestValue = value;
    }
  }
  return best;
}

function activityScore(volume: number, txCount: number): number {
  return txCount * 8 + Math.log10(volume + 1) * 5;
}

function countEntityTypes(nodes: TokenHolder[]): Partial<Record<EntityType, number>> {
  const counts: Partial<Record<EntityType, number>> = {};
  for (const node of nodes) {
    const type = node.entityType || "unknown";
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

export async function buildGraphData(
  contractAddress: string,
  limit: number,
  apiKey?: string
): Promise<GraphData> {
  const normalizedContract = normalizeAddress(contractAddress);
  const cacheKey = `token:${normalizedContract}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const metadata = await fetchTokenMetadata(normalizedContract, { apiKey });
  const { holders, totalSupply } = await fetchHolders(normalizedContract, limit, { apiKey });

  if (holders.length === 0) {
    throw new Error("No holders found for this token");
  }

  metadata.totalSupply = totalSupply;

  const identityCandidates = holders
    .slice(0, 80)
    .map((holder) => holder.address);
  const identityMap = await fetchIdentityInfo(identityCandidates);

  const nodes = holders.map((holder) => {
    const identity = identityMap.get(holder.address);
    const starkDomain = identity?.starkDomain || null;
    const cartridgeUsername = identity?.cartridgeUsername || null;
    const isZeroAddress = holder.address === ZERO_ADDRESS;
    const classification = isZeroAddress
      ? {
          type: "service" as const,
          label: "System",
          description: "Protocol zero address used for mint/burn flows.",
        }
      : classifyEntity({ alias: holder.alias });
    return {
      ...holder,
      alias: isZeroAddress
        ? holder.alias || "Zero Address"
        : selectDisplayAlias(holder.alias, starkDomain, cartridgeUsername),
      entityType: classification.type,
      entityLabel: classification.label,
      entityDescription: classification.description,
      starkDomain,
      cartridgeUsername,
    };
  });

  const holderAddresses = new Set(nodes.map((h) => h.address));
  const edges = await fetchTransfers(
    normalizedContract,
    holderAddresses,
    metadata.decimals,
    5,
    { apiKey }
  );

  const graphData: GraphData = {
    mode: "token",
    focusAddress: normalizedContract,
    token: metadata,
    nodes,
    edges,
    metadata: {
      holdersCount: nodes.length,
      edgesCount: edges.length,
      fetchedAt: new Date().toISOString(),
      entityCounts: countEntityTypes(nodes),
    },
  };

  setCache(cacheKey, graphData);
  return graphData;
}

export async function buildAddressGraphData(
  address: string,
  limit: number,
  options?: Partial<AddressGraphOptions>,
  apiKey?: string
): Promise<GraphData> {
  const normalizedAddress = normalizeAddress(address);
  const depth = Math.min(5, Math.max(1, options?.depth || 2));
  const maxTransfersPerAddress = Math.min(
    1000,
    Math.max(50, options?.maxTransfersPerAddress || 250)
  );
  const maxPagesPerAddress = Math.max(1, Math.ceil(maxTransfersPerAddress / 50));

  const cacheKey = `address:${normalizedAddress}:${limit}:d${depth}:m${maxTransfersPerAddress}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const queue: Array<{ address: string; hop: number }> = [{ address: normalizedAddress, hop: 0 }];
  const discovered = new Set<string>([normalizedAddress]);
  const processed = new Set<string>();
  const transferMap = new Map<string, AddressTransfer>();
  const aliasHints = new Map<string, string>();

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (processed.has(current.address)) continue;
    processed.add(current.address);

    const transfers = await fetchAddressTransfers(
      current.address,
      maxPagesPerAddress,
      maxTransfersPerAddress,
      { apiKey }
    );

    const candidatePeers = new Map<string, number>();

    for (const transfer of transfers) {
      const transferKey = `${transfer.txHash}:${transfer.from}:${transfer.to}:${transfer.tokenAddress}:${transfer.volume}`;
      if (!transferMap.has(transferKey)) {
        transferMap.set(transferKey, transfer);
      }
      if (transfer.fromAlias && !aliasHints.has(transfer.from)) {
        aliasHints.set(transfer.from, transfer.fromAlias);
      }
      if (transfer.toAlias && !aliasHints.has(transfer.to)) {
        aliasHints.set(transfer.to, transfer.toAlias);
      }

      const peer = transfer.from === current.address ? transfer.to : transfer.from;
      candidatePeers.set(peer, (candidatePeers.get(peer) || 0) + transfer.volume + 1);
    }

    if (current.hop >= depth - 1) continue;

    const sortedPeers = Array.from(candidatePeers.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([peer]) => peer);

    for (const peer of sortedPeers) {
      if (discovered.has(peer)) continue;
      if (discovered.size >= limit) break;
      discovered.add(peer);
      queue.push({ address: peer, hop: current.hop + 1 });
    }
  }

  const allTransfers = Array.from(transferMap.values());
  if (allTransfers.length === 0) {
    throw new Error("No transfer activity found for this address.");
  }

  const includedAddresses = new Set(Array.from(discovered).slice(0, limit));
  includedAddresses.add(normalizedAddress);

  type EdgeAggregate = {
    from: string;
    to: string;
    tokenAddress: string;
    volume: number;
    txCount: number;
  };
  const edgeMap = new Map<string, EdgeAggregate>();
  const tokenVolumeMap = new Map<string, number>();

  for (const transfer of allTransfers) {
    if (!includedAddresses.has(transfer.from) || !includedAddresses.has(transfer.to)) continue;
    if (transfer.from === transfer.to) continue;

    const edgeKey = `${transfer.from}:${transfer.to}:${transfer.tokenAddress}`;
    const existing = edgeMap.get(edgeKey);
    if (existing) {
      existing.volume += transfer.volume;
      existing.txCount += 1;
    } else {
      edgeMap.set(edgeKey, {
        from: transfer.from,
        to: transfer.to,
        tokenAddress: transfer.tokenAddress,
        volume: transfer.volume,
        txCount: 1,
      });
    }
    increment(tokenVolumeMap, transfer.tokenAddress, transfer.volume);
  }

  const nodeAddresses = Array.from(includedAddresses);
  const nodeProfiles = await fetchAddressProfiles(nodeAddresses, { apiKey });
  const identityMap = await fetchIdentityInfo(nodeAddresses);

  const tokenAddresses = Array.from(tokenVolumeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 120)
    .map(([address]) => address);
  const tokenProfiles =
    tokenAddresses.length > 0
      ? await fetchAddressProfiles(tokenAddresses, { apiKey })
      : new Map();

  type NodeStats = {
    incomingVolume: number;
    outgoingVolume: number;
    incomingTxCount: number;
    outgoingTxCount: number;
  };
  const statsMap = new Map<string, NodeStats>();
  for (const addr of nodeAddresses) {
    statsMap.set(addr, {
      incomingVolume: 0,
      outgoingVolume: 0,
      incomingTxCount: 0,
      outgoingTxCount: 0,
    });
  }

  for (const edge of edgeMap.values()) {
    const fromStats = statsMap.get(edge.from);
    const toStats = statsMap.get(edge.to);
    if (fromStats) {
      fromStats.outgoingVolume += edge.volume;
      fromStats.outgoingTxCount += edge.txCount;
    }
    if (toStats) {
      toStats.incomingVolume += edge.volume;
      toStats.incomingTxCount += edge.txCount;
    }
  }

  const rawNodes = nodeAddresses.map((nodeAddress) => {
    const profile = nodeProfiles.get(nodeAddress);
    const identity = identityMap.get(nodeAddress);
    const stats = statsMap.get(nodeAddress)!;
    const isZeroAddress = nodeAddress === ZERO_ADDRESS;
    const classification = isZeroAddress
      ? {
          type: "service" as const,
          label: "System",
          description: "Protocol zero address used for mint/burn flows.",
        }
      : classifyEntity({
          alias: aliasHints.get(nodeAddress) || profile?.alias || null,
          name: profile?.name || null,
          contractType: profile?.contractType || null,
          isToken: profile?.isErcToken,
        });
    const totalVolume = stats.incomingVolume + stats.outgoingVolume;
    const totalTx = stats.incomingTxCount + stats.outgoingTxCount;
    const score = activityScore(totalVolume, totalTx);
    return {
      address: nodeAddress,
      alias: isZeroAddress
        ? "Zero Address"
        : selectDisplayAlias(
            aliasHints.get(nodeAddress) || profile?.alias || null,
            identity?.starkDomain || null,
            identity?.cartridgeUsername || null
          ),
      balance: String(totalVolume),
      balanceFormatted: score,
      percentSupply: 0,
      rank: 0,
      entityType: classification.type,
      entityLabel: classification.label,
      entityDescription: classification.description,
      isFocus: nodeAddress === normalizedAddress,
      starkDomain: identity?.starkDomain || null,
      cartridgeUsername: identity?.cartridgeUsername || null,
      interactionTxCount: totalTx,
      incomingTxCount: stats.incomingTxCount,
      outgoingTxCount: stats.outgoingTxCount,
      incomingVolume: stats.incomingVolume,
      outgoingVolume: stats.outgoingVolume,
    } satisfies TokenHolder;
  });

  const totalScore = rawNodes.reduce((sum, node) => sum + node.balanceFormatted, 0);
  const nodes = rawNodes
    .sort((a, b) => {
      if (a.isFocus) return -1;
      if (b.isFocus) return 1;
      return b.balanceFormatted - a.balanceFormatted;
    })
    .map((node, index) => ({
      ...node,
      rank: index + 1,
      percentSupply: totalScore > 0 ? (node.balanceFormatted / totalScore) * 100 : 0,
    }));

  const edges: TransferEdge[] = Array.from(edgeMap.values())
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 3000)
    .map((edge) => ({
      from: edge.from,
      to: edge.to,
      volume: edge.volume,
      txCount: edge.txCount,
      relation: edge.to === normalizedAddress ? "funding" : "interaction",
      tokenAddress: edge.tokenAddress,
      tokenSymbol: tokenProfiles.get(edge.tokenAddress)?.tokenSymbol || null,
    }));

  const fundingMap = new Map<string, PeerAggregate>();
  for (const edge of edges) {
    if (edge.to !== normalizedAddress) continue;
    let agg = fundingMap.get(edge.from);
    if (!agg) {
      agg = {
        address: edge.from,
        alias: aliasHints.get(edge.from) || nodeProfiles.get(edge.from)?.alias || null,
        incomingVolume: 0,
        outgoingVolume: 0,
        incomingTxCount: 0,
        outgoingTxCount: 0,
        incomingTokens: new Map<string, number>(),
        outgoingTokens: new Map<string, number>(),
      };
      fundingMap.set(edge.from, agg);
    }
    agg.incomingVolume += edge.volume;
    agg.incomingTxCount += edge.txCount;
    if (edge.tokenAddress) {
      increment(agg.incomingTokens, edge.tokenAddress, edge.volume);
    }
  }

  const topFundingSources = Array.from(fundingMap.values())
    .sort((a, b) => b.incomingVolume - a.incomingVolume || b.incomingTxCount - a.incomingTxCount)
    .slice(0, 8);

  const fundingSources = topFundingSources.map((source) => {
    const profile = nodeProfiles.get(source.address);
    const classification = classifyEntity({
      alias: source.alias || profile?.alias || null,
      name: profile?.name || null,
      contractType: profile?.contractType || null,
      isToken: profile?.isErcToken,
    });
    const fundingTokenAddress = dominantKey(source.incomingTokens);
    return {
      address: source.address,
      alias: selectDisplayAlias(
        source.alias || profile?.alias || null,
        identityMap.get(source.address)?.starkDomain || null,
        identityMap.get(source.address)?.cartridgeUsername || null
      ),
      entityType: classification.type,
      entityLabel: classification.label,
      starkDomain: identityMap.get(source.address)?.starkDomain || null,
      cartridgeUsername: identityMap.get(source.address)?.cartridgeUsername || null,
      volume: source.incomingVolume,
      txCount: source.incomingTxCount,
      tokenSymbol: fundingTokenAddress
        ? tokenProfiles.get(fundingTokenAddress)?.tokenSymbol || null
        : null,
    };
  });

  const tokenLegend = Array.from(tokenVolumeMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([tokenAddress]) => {
      const tokenSymbol = tokenProfiles.get(tokenAddress)?.tokenSymbol || `${tokenAddress.slice(0, 6)}...`;
      return {
        tokenAddress,
        tokenSymbol,
        color: getTokenColor(tokenAddress, tokenSymbol),
      };
    });

  const totalIncomingVolume = fundingSources.reduce((sum, source) => sum + source.volume, 0);
  const totalIncomingTxCount = fundingSources.reduce((sum, source) => sum + source.txCount, 0);

  const graphData: GraphData = {
    mode: "address",
    focusAddress: normalizedAddress,
    token: {
      address: normalizedAddress,
      name: "Address Connectivity",
      symbol: "TX",
      decimals: 0,
      totalSupply: totalScore,
    },
    nodes,
    edges,
    metadata: {
      holdersCount: nodes.length,
      edgesCount: edges.length,
      fetchedAt: new Date().toISOString(),
      entityCounts: countEntityTypes(nodes),
      note: "Connections are inferred from recursive transfer crawling around the entered address.",
      exploration: {
        depth,
        processedAddresses: processed.size,
        maxTransfersPerAddress,
      },
      tokenLegend,
    },
    funding: {
      totalIncomingTxCount,
      totalIncomingVolume,
      sources: fundingSources,
    },
  };

  setCache(cacheKey, graphData);
  return graphData;
}
