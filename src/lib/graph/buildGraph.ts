import {
  fetchAddressProfiles,
  fetchAddressTransfers,
  fetchHolders,
  fetchTokenMetadata,
  fetchTransfers,
} from "@/lib/starknet/voyager";
import { getCached, setCache } from "@/lib/starknet/cache";
import { classifyEntity } from "@/lib/starknet/entityClassification";
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
  limit: number
): Promise<GraphData> {
  const normalizedContract = normalizeAddress(contractAddress);
  const cacheKey = `token:${normalizedContract}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const metadata = await fetchTokenMetadata(normalizedContract);
  const { holders, totalSupply } = await fetchHolders(normalizedContract, limit);

  if (holders.length === 0) {
    throw new Error("No holders found for this token");
  }

  metadata.totalSupply = totalSupply;

  const nodes = holders.map((holder) => {
    const classification = classifyEntity({ alias: holder.alias });
    return {
      ...holder,
      entityType: classification.type,
      entityLabel: classification.label,
      entityDescription: classification.description,
    };
  });

  const holderAddresses = new Set(nodes.map((h) => h.address));
  const edges = await fetchTransfers(normalizedContract, holderAddresses, metadata.decimals);

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
  limit: number
): Promise<GraphData> {
  const normalizedAddress = normalizeAddress(address);
  const cacheKey = `address:${normalizedAddress}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const transfers = await fetchAddressTransfers(normalizedAddress, 10);
  if (transfers.length === 0) {
    throw new Error("No transfer activity found for this address.");
  }

  const peerMap = new Map<string, PeerAggregate>();
  let totalIncomingVolume = 0;
  let totalIncomingTxCount = 0;

  for (const transfer of transfers) {
    const isIncoming = transfer.to === normalizedAddress;
    const peerAddress = isIncoming ? transfer.from : transfer.to;
    const peerAlias = isIncoming ? transfer.fromAlias : transfer.toAlias;

    let agg = peerMap.get(peerAddress);
    if (!agg) {
      agg = {
        address: peerAddress,
        alias: peerAlias || null,
        incomingVolume: 0,
        outgoingVolume: 0,
        incomingTxCount: 0,
        outgoingTxCount: 0,
        incomingTokens: new Map<string, number>(),
        outgoingTokens: new Map<string, number>(),
      };
      peerMap.set(peerAddress, agg);
    }

    if (!agg.alias && peerAlias) {
      agg.alias = peerAlias;
    }

    if (isIncoming) {
      agg.incomingVolume += transfer.volume;
      agg.incomingTxCount += 1;
      totalIncomingVolume += transfer.volume;
      totalIncomingTxCount += 1;
      increment(agg.incomingTokens, transfer.tokenAddress, transfer.volume);
    } else {
      agg.outgoingVolume += transfer.volume;
      agg.outgoingTxCount += 1;
      increment(agg.outgoingTokens, transfer.tokenAddress, transfer.volume);
    }
  }

  const maxPeers = Math.max(5, limit - 1);
  const selectedPeers = Array.from(peerMap.values())
    .sort((a, b) => {
      const scoreA = activityScore(a.incomingVolume + a.outgoingVolume, a.incomingTxCount + a.outgoingTxCount);
      const scoreB = activityScore(b.incomingVolume + b.outgoingVolume, b.incomingTxCount + b.outgoingTxCount);
      return scoreB - scoreA;
    })
    .slice(0, maxPeers);

  const nodeAddresses = [normalizedAddress, ...selectedPeers.map((peer) => peer.address)];

  const topFundingSources = Array.from(peerMap.values())
    .filter((peer) => peer.incomingTxCount > 0)
    .sort((a, b) => b.incomingVolume - a.incomingVolume || b.incomingTxCount - a.incomingTxCount)
    .slice(0, 8);

  const sourceAddresses = topFundingSources
    .map((source) => source.address)
    .filter((addr) => !nodeAddresses.includes(addr));

  const allProfiles = await fetchAddressProfiles([...nodeAddresses, ...sourceAddresses]);

  const tokenAddresses = Array.from(
    new Set(
      [...selectedPeers, ...topFundingSources]
        .flatMap((source) => [dominantKey(source.incomingTokens), dominantKey(source.outgoingTokens)])
        .filter((addr): addr is string => Boolean(addr))
    )
  );
  const tokenProfiles = tokenAddresses.length > 0 ? await fetchAddressProfiles(tokenAddresses) : new Map();

  const rootTotalVolume = transfers.reduce((sum, t) => sum + t.volume, 0);
  const rootTotalTxCount = transfers.length;
  const rootScore = activityScore(rootTotalVolume, rootTotalTxCount);

  const peerScores = selectedPeers.map((peer) =>
    activityScore(peer.incomingVolume + peer.outgoingVolume, peer.incomingTxCount + peer.outgoingTxCount)
  );
  const totalScore = rootScore + peerScores.reduce((sum, score) => sum + score, 0);

  const rootProfile = allProfiles.get(normalizedAddress);
  const rootClassification = classifyEntity({
    alias: rootProfile?.alias || null,
    name: rootProfile?.name || null,
    contractType: rootProfile?.contractType || null,
    isToken: rootProfile?.isErcToken,
  });

  const focusNode: TokenHolder = {
    address: normalizedAddress,
    alias: rootProfile?.alias || null,
    balance: String(rootTotalVolume),
    balanceFormatted: rootScore,
    percentSupply: totalScore > 0 ? (rootScore / totalScore) * 100 : 0,
    rank: 1,
    entityType: rootClassification.type,
    entityLabel: rootClassification.label,
    entityDescription: rootClassification.description,
    isFocus: true,
    interactionTxCount: rootTotalTxCount,
    incomingTxCount: totalIncomingTxCount,
    outgoingTxCount: rootTotalTxCount - totalIncomingTxCount,
    incomingVolume: totalIncomingVolume,
    outgoingVolume: rootTotalVolume - totalIncomingVolume,
  };

  const peerNodes = selectedPeers
    .map((peer, index) => {
      const profile = allProfiles.get(peer.address);
      const classification = classifyEntity({
        alias: peer.alias || profile?.alias || null,
        name: profile?.name || null,
        contractType: profile?.contractType || null,
        isToken: profile?.isErcToken,
      });

      const score = peerScores[index];
      const totalTx = peer.incomingTxCount + peer.outgoingTxCount;
      return {
        address: peer.address,
        alias: peer.alias || profile?.alias || null,
        balance: String(peer.incomingVolume + peer.outgoingVolume),
        balanceFormatted: score,
        percentSupply: totalScore > 0 ? (score / totalScore) * 100 : 0,
        rank: index + 2,
        entityType: classification.type,
        entityLabel: classification.label,
        entityDescription: classification.description,
        isFocus: false,
        interactionTxCount: totalTx,
        incomingTxCount: peer.outgoingTxCount,
        outgoingTxCount: peer.incomingTxCount,
        incomingVolume: peer.outgoingVolume,
        outgoingVolume: peer.incomingVolume,
      } satisfies TokenHolder;
    })
    .sort((a, b) => b.balanceFormatted - a.balanceFormatted)
    .map((node, index) => ({ ...node, rank: index + 2 }));

  const peerSet = new Set(peerNodes.map((node) => node.address));
  const edges: TransferEdge[] = [];
  for (const peer of selectedPeers) {
    if (!peerSet.has(peer.address)) continue;

    if (peer.incomingTxCount > 0) {
      const incomingTokenAddress = dominantKey(peer.incomingTokens);
      const incomingTokenSymbol = incomingTokenAddress
        ? tokenProfiles.get(incomingTokenAddress)?.tokenSymbol || null
        : null;
      edges.push({
        from: peer.address,
        to: normalizedAddress,
        volume: peer.incomingVolume,
        txCount: peer.incomingTxCount,
        relation: "funding",
        tokenAddress: incomingTokenAddress || undefined,
        tokenSymbol: incomingTokenSymbol,
      });
    }

    if (peer.outgoingTxCount > 0) {
      const outgoingTokenAddress = dominantKey(peer.outgoingTokens);
      const outgoingTokenSymbol = outgoingTokenAddress
        ? tokenProfiles.get(outgoingTokenAddress)?.tokenSymbol || null
        : null;
      edges.push({
        from: normalizedAddress,
        to: peer.address,
        volume: peer.outgoingVolume,
        txCount: peer.outgoingTxCount,
        relation: "interaction",
        tokenAddress: outgoingTokenAddress || undefined,
        tokenSymbol: outgoingTokenSymbol,
      });
    }
  }

  const fundingSources = topFundingSources.map((source) => {
    const profile = allProfiles.get(source.address);
    const classification = classifyEntity({
      alias: source.alias || profile?.alias || null,
      name: profile?.name || null,
      contractType: profile?.contractType || null,
      isToken: profile?.isErcToken,
    });
    const fundingTokenAddress = dominantKey(source.incomingTokens);
    const fundingTokenSymbol = fundingTokenAddress
      ? tokenProfiles.get(fundingTokenAddress)?.tokenSymbol || null
      : null;
    return {
      address: source.address,
      alias: source.alias || profile?.alias || null,
      entityType: classification.type,
      entityLabel: classification.label,
      volume: source.incomingVolume,
      txCount: source.incomingTxCount,
      tokenSymbol: fundingTokenSymbol,
    };
  });

  const nodes = [focusNode, ...peerNodes];

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
      note: "Connections are inferred from recent transfer activity for the entered address.",
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
