"use client";

import { truncateAddress, formatBalance, formatPercent } from "@/lib/utils/format";
import type { SimulationNode } from "@/types";

interface BubbleTooltipProps {
  node: SimulationNode | null;
  position: { x: number; y: number } | null;
  tokenSymbol: string;
}

export default function BubbleTooltip({ node, position, tokenSymbol }: BubbleTooltipProps) {
  if (!node || !position) return null;

  return (
    <div
      className="fixed bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-3 text-sm text-white pointer-events-none z-50 max-w-xs transition-opacity duration-150"
      style={{ left: position.x + 15, top: position.y + 15 }}
    >
      {node.alias && (
        <p className="font-bold text-amber-400 mb-0.5">{node.alias}</p>
      )}
      <p className="text-gray-300 font-mono text-xs mb-1.5">
        {truncateAddress(node.address, 8)}
      </p>
      <div className="space-y-0.5 text-xs">
        <p>
          <span className="text-gray-400">Balance:</span>{" "}
          <span className="font-medium">{formatBalance(node.balanceFormatted)} {tokenSymbol}</span>
        </p>
        <p>
          <span className="text-gray-400">Supply:</span>{" "}
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
