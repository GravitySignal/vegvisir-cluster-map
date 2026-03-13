import { fetchTokenMetadata, fetchHolders, fetchTransfers } from "@/lib/starknet/voyager";
import { getCached, setCache } from "@/lib/starknet/cache";
import type { GraphData } from "@/types";

export async function buildGraphData(
  contractAddress: string,
  limit: number
): Promise<GraphData> {
  const cacheKey = `${contractAddress}:${limit}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const metadata = await fetchTokenMetadata(contractAddress);
  const { holders, totalSupply } = await fetchHolders(contractAddress, limit);

  if (holders.length === 0) {
    throw new Error("No holders found for this token");
  }

  metadata.totalSupply = totalSupply;

  const holderAddresses = new Set(holders.map((h) => h.address));
  const edges = await fetchTransfers(contractAddress, holderAddresses, metadata.decimals);

  const graphData: GraphData = {
    token: metadata,
    nodes: holders,
    edges,
    metadata: {
      holdersCount: holders.length,
      edgesCount: edges.length,
      fetchedAt: new Date().toISOString(),
    },
  };

  setCache(cacheKey, graphData);
  return graphData;
}
