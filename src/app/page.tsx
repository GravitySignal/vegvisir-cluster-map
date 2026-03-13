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
import type { SimulationNode } from "@/types";

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
        <div className="border-b border-gray-800 px-4 py-2 text-gray-400 text-xs">
          <span>{graphData.metadata.holdersCount} holders</span>
          <span className="mx-2">&middot;</span>
          <span>{graphData.metadata.edgesCount} connections</span>
          <span className="mx-2">&middot;</span>
          <span>
            {graphData.token.name} ({graphData.token.symbol})
          </span>
          <span className="mx-2">&middot;</span>
          <span>
            fetched at{" "}
            {new Date(graphData.metadata.fetchedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      )}

      {/* Error banner */}
      <ErrorBanner message={error} onDismiss={handleDismissError} />

      {/* Main content */}
      <main className="flex-1 flex items-center justify-center relative">
        <LoadingState isLoading={isLoading} />

        {!isLoading && !graphData && !error && (
          <p className="text-gray-500 text-lg">
            Enter a token address to generate the bubble map
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
      />

      {/* Detail panel */}
      <DetailPanel
        node={selectedNode}
        tokenSymbol={graphData?.token.symbol ?? ""}
        edges={graphData?.edges ?? []}
        nodes={graphData?.nodes ?? []}
        onClose={handleClosePanel}
      />
    </div>
  );
}
