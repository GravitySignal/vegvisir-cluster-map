"use client";

import { useState, useCallback, useMemo } from "react";
import TokenInput from "@/components/TokenInput";
import BubbleMap from "@/components/BubbleMap";
import BubbleTooltip from "@/components/BubbleTooltip";
import DetailPanel from "@/components/DetailPanel";
import LoadingState from "@/components/LoadingState";
import ErrorBanner from "@/components/ErrorBanner";
import { useGraphData } from "@/hooks/useGraphData";
import { useTooltip } from "@/hooks/useTooltip";
import { entityColor } from "@/lib/starknet/entityClassification";
import { truncateAddress } from "@/lib/utils/format";
import { normalizeAddress } from "@/lib/utils/validation";
import type { EntityType, SimulationNode } from "@/types";

export default function Home() {
  const { graphData, isLoading, error, setError, fetchGraph, expandGraphFromNode } = useGraphData();
  const { tooltipNode, tooltipPos, handleNodeHover } = useTooltip();
  const [selectedNode, setSelectedNode] = useState<SimulationNode | null>(null);
  const [autoPanelFocusAddress, setAutoPanelFocusAddress] = useState<string | null>(null);
  const [expandedAddresses, setExpandedAddresses] = useState<Set<string>>(new Set());
  const [requestContext, setRequestContext] = useState<{
    mode: "token" | "address";
    depth: number;
    maxTransfersPerAddress: number;
    voyagerApiKey?: string;
    action: "explore" | "expand";
  }>({
    mode: "address",
    depth: 2,
    maxTransfersPerAddress: 250,
    action: "explore",
  });
  const [exploreOptions, setExploreOptions] = useState<{
    limit: number;
    depth: number;
    maxTransfersPerAddress: number;
    voyagerApiKey?: string;
  }>({
    limit: 80,
    depth: 2,
    maxTransfersPerAddress: 250,
  });

  const expandedCount = useMemo(() => expandedAddresses.size, [expandedAddresses]);
  const lowSignalNotice = useMemo(() => {
    if (!graphData || graphData.mode !== "address") return null;
    const hasZero = graphData.nodes.some((node) =>
      node.address === "0x0000000000000000000000000000000000000000000000000000000000000000"
    );
    if (graphData.nodes.length <= 2 && hasZero) {
      return "Limited signal: this address mostly interacts with the zero address (mint/burn/system flow).";
    }
    if (graphData.nodes.length <= 2) {
      return "Limited signal: only a small number of connected addresses were found.";
    }
    return null;
  }, [graphData]);

  const panelNode = useMemo(() => {
    if (selectedNode) return selectedNode;
    if (!graphData || !autoPanelFocusAddress) return null;
    if (graphData.focusAddress !== autoPanelFocusAddress) return null;
    const focus = graphData.nodes.find((node) => node.address === graphData.focusAddress);
    if (!focus) return null;
    return {
      ...focus,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      fx: null,
      fy: null,
      radius: 24,
    } satisfies SimulationNode;
  }, [selectedNode, graphData, autoPanelFocusAddress]);

  const handleSubmitGraph = useCallback(
    (
      address: string,
      limit: number,
      mode: "token" | "address",
      options?: { depth: number; maxTransfersPerAddress: number; voyagerApiKey?: string }
    ) => {
      const depth = options?.depth || 2;
      const maxTransfersPerAddress = options?.maxTransfersPerAddress || 250;
      const voyagerApiKey = options?.voyagerApiKey?.trim() || undefined;
      setRequestContext({
        mode,
        depth,
        maxTransfersPerAddress,
        voyagerApiKey,
        action: "explore",
      });
      setExploreOptions({ limit, depth, maxTransfersPerAddress, voyagerApiKey });
      const normalized = normalizeAddress(address);
      setExpandedAddresses(new Set([normalized]));
      setSelectedNode(null);
      setAutoPanelFocusAddress(normalized);
      fetchGraph(address, limit, mode, options);
    },
    [fetchGraph]
  );

  const handleNodeClick = useCallback((node: SimulationNode) => {
    setSelectedNode(node);
    setAutoPanelFocusAddress(null);
  }, []);

  const handleNodeDoubleClick = useCallback(
    async (node: SimulationNode) => {
      if (!graphData || graphData.mode !== "address") return;
      if (expandedAddresses.has(node.address)) return;
      setRequestContext((ctx) => ({ ...ctx, mode: "address", action: "expand" }));
      await expandGraphFromNode(node.address, exploreOptions.limit, {
        maxTransfersPerAddress: exploreOptions.maxTransfersPerAddress,
        voyagerApiKey: exploreOptions.voyagerApiKey,
      });
      setExpandedAddresses((prev) => {
        const next = new Set(prev);
        next.add(node.address);
        return next;
      });
    },
    [expandGraphFromNode, expandedAddresses, exploreOptions, graphData]
  );

  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
    setAutoPanelFocusAddress(null);
  }, []);

  const handleDismissError = useCallback(() => {
    setError(null);
  }, [setError]);

  return (
    <div className="flex flex-col min-h-screen bg-gray-900">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900/95 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex flex-col gap-3">
            <h1 className="text-xl font-bold text-white tracking-tight">
              Vegvisir Cluster Map
            </h1>
            <TokenInput onSubmit={handleSubmitGraph} isLoading={isLoading} />
          </div>
        </div>
      </header>

      {/* Stats bar */}
      {graphData && (
        <div className="border-b border-gray-800 px-4 py-2 text-gray-400 text-xs space-y-2">
          <div>
            <span>
              {graphData.mode === "address"
                ? `${graphData.metadata.holdersCount - 1} connected addresses`
                : `${graphData.metadata.holdersCount} holders`}
            </span>
            <span className="mx-2">&middot;</span>
            <span>{graphData.metadata.edgesCount} connections</span>
            <span className="mx-2">&middot;</span>
            {graphData.mode === "address" ? (
              <span>
                focus: {truncateAddress(graphData.focusAddress, 6)}
                {graphData.metadata.exploration && (
                  <> • depth {graphData.metadata.exploration.depth} • {graphData.metadata.exploration.processedAddresses} addresses processed</>
                )}
                {expandedCount > 0 && (
                  <> • expanded nodes {expandedCount}</>
                )}
              </span>
            ) : (
              <span>
                {graphData.token.name} ({graphData.token.symbol})
              </span>
            )}
            {graphData.mode === "address" && graphData.funding?.sources[0] && (
              <>
                <span className="mx-2">&middot;</span>
                <span>
                  top funder:{" "}
                  {graphData.funding.sources[0].alias ||
                    truncateAddress(graphData.funding.sources[0].address)}
                </span>
              </>
            )}
            <span className="mx-2">&middot;</span>
            <span>
              fetched at{" "}
              {new Date(graphData.metadata.fetchedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </span>
          </div>
          {graphData.metadata.entityCounts && (
            <div className="flex flex-wrap gap-2">
              {Object.entries(graphData.metadata.entityCounts).map(([type, count]) => (
                <span
                  key={type}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-gray-700"
                >
                    <span
                      className="inline-block w-2 h-2 rounded-full"
                      style={{ backgroundColor: entityColor(type as EntityType) }}
                    />
                  <span className="text-gray-300 capitalize">
                    {type}: {count}
                  </span>
                </span>
              ))}
            </div>
          )}
          {graphData.mode === "address" && graphData.metadata.tokenLegend && graphData.metadata.tokenLegend.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {graphData.metadata.tokenLegend.map((token) => (
                <span
                  key={token.tokenAddress}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-gray-700"
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full"
                    style={{ backgroundColor: token.color }}
                  />
                  <span className="text-gray-300 uppercase">{token.tokenSymbol}</span>
                </span>
              ))}
            </div>
          )}
          {lowSignalNotice && (
            <div className="text-amber-300 bg-amber-500/10 border border-amber-700/40 rounded px-2 py-1">
              {lowSignalNotice}
            </div>
          )}
        </div>
      )}

      {/* Error banner */}
      <ErrorBanner message={error} onDismiss={handleDismissError} />

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center relative">
        <LoadingState
          isLoading={isLoading}
          mode={requestContext.mode}
          depth={requestContext.depth}
          maxTransfersPerAddress={requestContext.maxTransfersPerAddress}
          action={requestContext.action}
        />

        {!isLoading && !graphData && !error && (
          <p className="text-gray-500 text-lg">
            Enter a Starknet address to map connected addresses and funding sources
          </p>
        )}

        {graphData && (
          <div className="w-full h-full flex flex-col">
            {graphData.mode === "address" && (
              <div className="px-4 py-2 text-[11px] text-cyan-200/90 border-b border-cyan-900/40 bg-cyan-950/20">
                Click a bubble for details. Double-click to expand that node with 1-hop neighbors.
              </div>
            )}
            <BubbleMap
              graphData={graphData}
              onNodeHover={handleNodeHover}
              onNodeClick={handleNodeClick}
              onNodeDoubleClick={handleNodeDoubleClick}
              expandedAddresses={expandedAddresses}
            />
          </div>
        )}
      </main>

      {/* Tooltip */}
      <BubbleTooltip
        node={tooltipNode}
        position={tooltipPos}
        tokenSymbol={graphData?.token.symbol ?? ""}
        mode={graphData?.mode ?? "token"}
      />

      {/* Detail panel */}
      <DetailPanel
        node={panelNode}
        tokenSymbol={graphData?.token.symbol ?? ""}
        edges={graphData?.edges ?? []}
        nodes={graphData?.nodes ?? []}
        mode={graphData?.mode ?? "token"}
        funding={graphData?.funding}
        onClose={handleClosePanel}
      />
    </div>
  );
}
