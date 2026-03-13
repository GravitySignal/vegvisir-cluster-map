"use client";

import { useState } from "react";
import { truncateAddress, formatBalance, formatPercent } from "@/lib/utils/format";
import type { SimulationNode, TransferEdge, TokenHolder } from "@/types";

interface DetailPanelProps {
  node: SimulationNode | null;
  tokenSymbol: string;
  edges: TransferEdge[];
  nodes: TokenHolder[];
  onClose: () => void;
}

export default function DetailPanel({ node, tokenSymbol, edges, nodes, onClose }: DetailPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!node) return null;

  const connections = edges
    .filter((e) => e.from === node.address || e.to === node.address)
    .map((e) => {
      const isSender = e.from === node.address;
      const peerAddr = isSender ? e.to : e.from;
      const peer = nodes.find((n) => n.address === peerAddr);
      return {
        direction: isSender ? "sent" as const : "received" as const,
        peerAddress: peerAddr,
        peerAlias: peer?.alias || null,
        volume: e.volume,
        txCount: e.txCount,
      };
    })
    .sort((a, b) => b.volume - a.volume)
    .slice(0, 20);

  function handleCopy() {
    navigator.clipboard.writeText(node!.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed top-0 right-0 h-full w-[380px] bg-gray-800 border-l border-gray-700 text-white z-50 flex flex-col transform transition-transform duration-300 translate-x-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold">Wallet Details</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-lg leading-none"
        >
          &times;
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        {/* Alias badge */}
        {node.alias && (
          <span className="inline-block px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-md font-medium">
            {node.alias}
          </span>
        )}

        {/* Address */}
        <div>
          <p className="text-gray-400 text-xs mb-1">Address</p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-gray-200 break-all flex-1">
              {node.address}
            </code>
            <button
              onClick={handleCopy}
              className="text-xs text-blue-400 hover:text-blue-300 shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {/* Balance */}
        <div>
          <p className="text-gray-400 text-xs mb-1">Balance</p>
          <p className="text-xl font-bold">
            {formatBalance(node.balanceFormatted)}{" "}
            <span className="text-sm text-gray-400 font-normal">{tokenSymbol}</span>
          </p>
        </div>

        {/* % of Supply */}
        <div>
          <p className="text-gray-400 text-xs mb-1">% of Supply</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${Math.min(node.percentSupply, 100)}%` }}
              />
            </div>
            <span className="text-sm font-medium">{formatPercent(node.percentSupply)}</span>
          </div>
        </div>

        {/* Rank */}
        <div>
          <p className="text-gray-400 text-xs mb-1">Rank</p>
          <p className="text-lg font-bold">#{node.rank}</p>
        </div>

        {/* Connections */}
        {connections.length > 0 && (
          <div>
            <p className="text-gray-400 text-xs mb-2">
              Connections ({connections.length})
            </p>
            <div className="space-y-2">
              {connections.map((c, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between text-xs bg-gray-700/50 rounded px-2 py-1.5"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className={c.direction === "sent" ? "text-red-400" : "text-green-400"}>
                      {c.direction === "sent" ? "→" : "←"}
                    </span>
                    <span className="text-gray-300 truncate">
                      {c.peerAlias || truncateAddress(c.peerAddress)}
                    </span>
                  </div>
                  <span className="text-gray-400 shrink-0 ml-2">
                    {formatBalance(c.volume, 0)} {tokenSymbol}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Explorer link */}
        <a
          href={`https://voyager.online/contract/${node.address}`}
          target="_blank"
          rel="noopener noreferrer"
          className="block w-full text-center px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
        >
          View on Voyager
        </a>
      </div>
    </div>
  );
}
