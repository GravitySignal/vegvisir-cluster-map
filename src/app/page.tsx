"use client";

import { useState, useCallback } from "react";
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
import type { EntityType, SimulationNode } from "@/types";

export default function Home() {
  const { graphData, isLoading, error, setError, fetchGraph } = useGraphData();
  const { tooltipNode, tooltipPos, handleNodeHover } = useTooltip();
  const [selectedNode, setSelectedNode] = useState<SimulationNode | null>(null);

  const handleNodeClick = useCallback((node: SimulationNode) => {
    setSelectedNode(node);
  }, []);

  const handleClosePanel = useCallback(() => {
    setSelectedNode(null);
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
              Starknet Bubble Map
            </h1>
            <TokenInput onSubmit={fetchGraph} isLoading={isLoading} />
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
              <span>focus: {truncateAddress(graphData.focusAddress, 6)}</span>
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
        </div>
      )}

      {/* Error banner */}
      <ErrorBanner message={error} onDismiss={handleDismissError} />

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center relative">
        <LoadingState isLoading={isLoading} />

        {!isLoading && !graphData && !error && (
          <p className="text-gray-500 text-lg">
            Enter a Starknet address to map connected addresses and funding sources
          </p>
        )}

        {graphData && (
          <BubbleMap
            graphData={graphData}
            onNodeHover={handleNodeHover}
            onNodeClick={handleNodeClick}
          />
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
        node={selectedNode}
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
