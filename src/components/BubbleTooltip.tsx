"use client";

import { formatAddressLabel, formatBalance, formatPercent, isZeroAddress } from "@/lib/utils/format";
import type { GraphMode, SimulationNode } from "@/types";

interface BubbleTooltipProps {
  node: SimulationNode | null;
  position: { x: number; y: number } | null;
  tokenSymbol: string;
  mode: GraphMode;
}

export default function BubbleTooltip({ node, position, tokenSymbol, mode }: BubbleTooltipProps) {
  if (!node || !position) return null;
  const zeroAddress = isZeroAddress(node.address);

  return (
    <div
      className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 text-sm text-white pointer-events-none z-50 max-w-xs transition-opacity duration-150"
      style={{ left: position.x + 15, top: position.y + 15 }}
    >
      {node.alias && (
        <p className="font-bold text-amber-400 mb-0.5">{node.alias}</p>
      )}
      {(node.entityLabel || zeroAddress) && (
        <p className="text-[11px] uppercase tracking-wide text-cyan-300 mb-0.5">
          {zeroAddress ? "System" : node.entityLabel}
        </p>
      )}
      <p className="text-gray-300 font-mono text-xs mb-1.5">
        {formatAddressLabel(node.address, 8)}
      </p>
      <div className="space-y-0.5 text-xs">
        {mode === "address" ? (
          <p>
            <span className="text-gray-400">Interactions:</span>{" "}
            <span className="font-medium">{node.interactionTxCount ?? 0} tx</span>
          </p>
        ) : (
          <p>
            <span className="text-gray-400">Balance:</span>{" "}
            <span className="font-medium">{formatBalance(node.balanceFormatted)} {tokenSymbol}</span>
          </p>
        )}
        <p>
          <span className="text-gray-400">{mode === "address" ? "Graph share:" : "Supply:"}</span>{" "}
          <span className="font-medium">{formatPercent(node.percentSupply)}</span>
        </p>
        <p>
          <span className="text-gray-400">Rank:</span>{" "}
          <span className="font-medium">#{node.rank}</span>
        </p>
      </div>
    </div>
  );
}
