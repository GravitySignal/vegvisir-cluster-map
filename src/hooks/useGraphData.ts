"use client";

import { useState, useCallback, useRef } from "react";
import type { EntityType, GraphData, GraphMode, TokenHolder, TransferEdge } from "@/types";

interface GraphFetchOptions {
  depth: number;
  maxTransfersPerAddress: number;
}

function countEntityTypes(nodes: TokenHolder[]): Partial<Record<EntityType, number>> {
  const counts: Partial<Record<EntityType, number>> = {};
  for (const node of nodes) {
    const type = node.entityType || "unknown";
    counts[type] = (counts[type] || 0) + 1;
  }
  return counts;
}

function mergeAddressGraphs(base: GraphData, incoming: GraphData): GraphData {
  if (base.mode !== "address" || incoming.mode !== "address") {
    return base;
  }

  const nodeMap = new Map<string, TokenHolder>();
  for (const node of base.nodes) {
    nodeMap.set(node.address, node);
  }
  for (const node of incoming.nodes) {
    const existing = nodeMap.get(node.address);
    if (!existing) {
      nodeMap.set(node.address, node);
      continue;
    }
    nodeMap.set(node.address, {
      ...existing,
      ...node,
      isFocus: existing.isFocus || node.isFocus,
      alias: existing.alias || node.alias,
    });
  }

  const MAX_MERGED_NODES = 220;
  const mergedNodes = Array.from(nodeMap.values())
    .sort((a, b) => {
      if (a.address === base.focusAddress) return -1;
      if (b.address === base.focusAddress) return 1;
      return (b.balanceFormatted || 0) - (a.balanceFormatted || 0);
    })
    .slice(0, MAX_MERGED_NODES);

  const allowedAddresses = new Set(mergedNodes.map((node) => node.address));

  const edgeMap = new Map<string, TransferEdge>();
  const addEdge = (edge: TransferEdge) => {
    if (!allowedAddresses.has(edge.from) || !allowedAddresses.has(edge.to)) return;
    const key = `${edge.from}:${edge.to}:${edge.tokenAddress || "na"}`;
    const existing = edgeMap.get(key);
    if (existing) {
      existing.volume += edge.volume;
      existing.txCount += edge.txCount;
      if (!existing.tokenSymbol && edge.tokenSymbol) {
        existing.tokenSymbol = edge.tokenSymbol;
      }
    } else {
      edgeMap.set(key, { ...edge });
    }
  };

  for (const edge of base.edges) addEdge(edge);
  for (const edge of incoming.edges) addEdge(edge);

  const MAX_MERGED_EDGES = 3500;
  const mergedEdges = Array.from(edgeMap.values())
    .sort((a, b) => b.volume - a.volume)
    .slice(0, MAX_MERGED_EDGES);

  const totalScore = mergedNodes.reduce((sum, node) => sum + (node.balanceFormatted || 0), 0);
  const rankedNodes = mergedNodes
    .map((node) => ({
      ...node,
      percentSupply: totalScore > 0 ? ((node.balanceFormatted || 0) / totalScore) * 100 : 0,
    }))
    .sort((a, b) => {
      if (a.address === base.focusAddress) return -1;
      if (b.address === base.focusAddress) return 1;
      return (b.balanceFormatted || 0) - (a.balanceFormatted || 0);
    })
    .map((node, index) => ({ ...node, rank: index + 1 }));

  const tokenLegendMap = new Map<string, { tokenAddress: string; tokenSymbol: string; color: string }>();
  for (const token of base.metadata.tokenLegend || []) tokenLegendMap.set(token.tokenAddress, token);
  for (const token of incoming.metadata.tokenLegend || []) tokenLegendMap.set(token.tokenAddress, token);

  return {
    ...base,
    nodes: rankedNodes,
    edges: mergedEdges,
    metadata: {
      ...base.metadata,
      holdersCount: rankedNodes.length,
      edgesCount: mergedEdges.length,
      fetchedAt: new Date().toISOString(),
      entityCounts: countEntityTypes(rankedNodes),
      tokenLegend: Array.from(tokenLegendMap.values()),
      exploration: {
        depth: Math.max(base.metadata.exploration?.depth || 1, incoming.metadata.exploration?.depth || 1),
        processedAddresses: (base.metadata.exploration?.processedAddresses || 0)
          + (incoming.metadata.exploration?.processedAddresses || 0),
        maxTransfersPerAddress: Math.max(
          base.metadata.exploration?.maxTransfersPerAddress || 0,
          incoming.metadata.exploration?.maxTransfersPerAddress || 0
        ),
      },
    },
  };
}

export function useGraphData() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);

  const requestGraph = useCallback(
    async (
      target: string,
      limit: number,
      mode: GraphMode,
      options?: Partial<GraphFetchOptions>,
      signal?: AbortSignal
    ): Promise<GraphData> => {
      const depth = Math.min(3, Math.max(1, options?.depth || 2));
      const maxTransfers = Math.min(
        1000,
        Math.max(50, options?.maxTransfersPerAddress || 250)
      );
      const res = await fetch(
        `/api/graph?target=${encodeURIComponent(target)}&limit=${limit}&mode=${mode}&depth=${depth}&maxTransfers=${maxTransfers}`,
        signal ? { signal } : undefined
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch graph data");
      return data as GraphData;
    },
    []
  );

  const fetchGraph = useCallback(
    async (
      target: string,
      limit: number,
      mode: GraphMode,
      options?: Partial<GraphFetchOptions>
    ) => {
      setIsLoading(true);
      setError(null);
      requestAbortRef.current?.abort();
      const controller = new AbortController();
      requestAbortRef.current = controller;
      try {
        const data = await requestGraph(target, limit, mode, options, controller.signal);
        setGraphData(data);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (requestAbortRef.current === controller) {
          requestAbortRef.current = null;
        }
        setIsLoading(false);
      }
    },
    [requestGraph]
  );

  const expandGraphFromNode = useCallback(
    async (
      address: string,
      limit: number,
      options?: Partial<GraphFetchOptions>
    ) => {
      if (!graphData || graphData.mode !== "address") return;
      setIsLoading(true);
      setError(null);
      try {
        const expansion = await requestGraph(address, limit, "address", {
          depth: 1,
          maxTransfersPerAddress: options?.maxTransfersPerAddress || 200,
        });
        setGraphData((current) => {
          if (!current || current.mode !== "address") return current;
          return mergeAddressGraphs(current, expansion);
        });
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    },
    [graphData, requestGraph]
  );

  return { graphData, isLoading, error, setError, fetchGraph, expandGraphFromNode };
}
