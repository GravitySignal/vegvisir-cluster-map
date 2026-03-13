"use client";

import { useState } from "react";
import { truncateAddress, formatBalance, formatPercent } from "@/lib/utils/format";
import type { GraphData, GraphMode, SimulationNode, TransferEdge, TokenHolder } from "@/types";

interface DetailPanelProps {
  node: SimulationNode | null;
  tokenSymbol: string;
  edges: TransferEdge[];
  nodes: TokenHolder[];
  mode: GraphMode;
  funding?: GraphData["funding"];
  onClose: () => void;
}

export default function DetailPanel({
  node,
  tokenSymbol,
  edges,
  nodes,
  mode,
  funding,
  onClose,
}: DetailPanelProps) {
  const [copied, setCopied] = useState(false);

  if (!node) return null;
  const selectedNode = node;

  const nodeByAddress = new Map(nodes.map((n) => [n.address, n]));

  const connections = edges
    .filter((e) => e.from === selectedNode.address || e.to === selectedNode.address)
    .map((e) => {
      const isSender = e.from === selectedNode.address;
      const peerAddr = isSender ? e.to : e.from;
      const peer = nodeByAddress.get(peerAddr);
      return {
        direction: isSender ? ("sent" as const) : ("received" as const),
        relation: e.relation || "interaction",
        peerAddress: peerAddr,
        peerAlias: peer?.alias || null,
        peerEntityLabel: peer?.entityLabel || "Unknown",
        volume: e.volume,
        txCount: e.txCount,
        tokenSymbol: e.tokenSymbol || null,
      };
    })
    .sort((a, b) => b.txCount - a.txCount || b.volume - a.volume)
    .slice(0, 24);

  function handleCopy() {
    navigator.clipboard.writeText(selectedNode.address).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="fixed top-0 right-0 h-full w-[380px] bg-gray-800 border-l border-gray-700 text-white z-50 flex flex-col transform transition-transform duration-300 translate-x-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <h2 className="text-sm font-semibold">Address Details</h2>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-lg leading-none"
        >
          &times;
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          {selectedNode.alias && (
            <span className="inline-block px-2 py-1 bg-amber-500/20 text-amber-400 text-xs rounded-md font-medium">
              {selectedNode.alias}
            </span>
          )}
          <span className="inline-block px-2 py-1 bg-cyan-500/20 text-cyan-300 text-xs rounded-md font-medium">
            {selectedNode.entityLabel || "Unknown"}
          </span>
          {selectedNode.isFocus && mode === "address" && (
            <span className="inline-block px-2 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-md font-medium">
              Entered Address
            </span>
          )}
        </div>

        {selectedNode.entityDescription && (
          <p className="text-xs text-gray-300 leading-relaxed">{selectedNode.entityDescription}</p>
        )}

        <div>
          <p className="text-gray-400 text-xs mb-1">Address</p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-gray-200 break-all flex-1">
              {selectedNode.address}
            </code>
            <button
              onClick={handleCopy}
              className="text-xs text-blue-400 hover:text-blue-300 shrink-0"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>

        {(selectedNode.starkDomain || selectedNode.cartridgeUsername) && (
          <div className="grid grid-cols-1 gap-2 text-xs">
            {selectedNode.starkDomain && (
              <div className="bg-gray-700/40 rounded px-2 py-1.5">
                <span className="text-gray-400">.stark:</span>{" "}
                <span className="text-cyan-200">{selectedNode.starkDomain}</span>
              </div>
            )}
            {selectedNode.cartridgeUsername && (
              <div className="bg-gray-700/40 rounded px-2 py-1.5">
                <span className="text-gray-400">Cartridge:</span>{" "}
                <span className="text-cyan-200">@{selectedNode.cartridgeUsername}</span>
              </div>
            )}
          </div>
        )}

        {mode === "token" ? (
          <div>
            <p className="text-gray-400 text-xs mb-1">Balance</p>
            <p className="text-xl font-bold">
              {formatBalance(selectedNode.balanceFormatted)}{" "}
              <span className="text-sm text-gray-400 font-normal">{tokenSymbol}</span>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="bg-gray-700/40 rounded-lg p-2.5">
              <p className="text-gray-400 mb-1">Incoming</p>
              <p className="font-semibold text-green-300">{selectedNode.incomingTxCount ?? 0} tx</p>
              <p className="text-gray-400">{formatBalance(selectedNode.incomingVolume ?? 0, 0)}</p>
            </div>
            <div className="bg-gray-700/40 rounded-lg p-2.5">
              <p className="text-gray-400 mb-1">Outgoing</p>
              <p className="font-semibold text-red-300">{selectedNode.outgoingTxCount ?? 0} tx</p>
              <p className="text-gray-400">{formatBalance(selectedNode.outgoingVolume ?? 0, 0)}</p>
            </div>
          </div>
        )}

        <div>
          <p className="text-gray-400 text-xs mb-1">{mode === "address" ? "Graph share" : "% of Supply"}</p>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{ width: `${Math.min(selectedNode.percentSupply, 100)}%` }}
              />
            </div>
            <span className="text-sm font-medium">{formatPercent(selectedNode.percentSupply)}</span>
          </div>
        </div>

        <div>
          <p className="text-gray-400 text-xs mb-1">Rank</p>
          <p className="text-lg font-bold">#{selectedNode.rank}</p>
        </div>

        {mode === "address" && selectedNode.isFocus && funding && funding.sources.length > 0 && (
          <div>
            <p className="text-gray-400 text-xs mb-2">Funding Sources (incoming)</p>
            <div className="space-y-2">
              {funding.sources.slice(0, 8).map((source) => (
                <div
                  key={source.address}
                  className="bg-gray-700/50 rounded px-2 py-2"
                >
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-gray-200 truncate pr-2">
                      {source.alias || truncateAddress(source.address)}
                    </span>
                    <span className="text-cyan-300">{source.entityLabel || source.entityType}</span>
                  </div>
                  {(source.starkDomain || source.cartridgeUsername) && (
                    <div className="text-[11px] text-cyan-200/90 mb-0.5">
                      {source.starkDomain || (source.cartridgeUsername ? `@${source.cartridgeUsername}` : "")}
                    </div>
                  )}
                  <div className="text-[11px] text-gray-400">
                    {source.txCount} tx • {formatBalance(source.volume, 0)}
                    {source.tokenSymbol ? ` ${source.tokenSymbol}` : ""}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {connections.length > 0 && (
          <div>
            <p className="text-gray-400 text-xs mb-2">
              Connections ({connections.length})
            </p>
            <div className="space-y-2">
              {connections.map((c, i) => (
                <div
                  key={`${c.peerAddress}-${i}`}
                  className="text-xs bg-gray-700/50 rounded px-2 py-1.5"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className={c.direction === "sent" ? "text-red-400" : "text-green-400"}>
                        {c.direction === "sent" ? "→" : "←"}
                      </span>
                      <span className="text-gray-300 truncate">
                        {c.peerAlias || truncateAddress(c.peerAddress)}
                      </span>
                    </div>
                    <span className="text-gray-400 shrink-0 ml-2">
                      {c.txCount} tx
                    </span>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-[11px] text-gray-400">
                    <span>{c.peerEntityLabel}</span>
                    <span>
                      {formatBalance(c.volume, 0)}
                      {c.tokenSymbol ? ` ${c.tokenSymbol}` : mode === "token" ? ` ${tokenSymbol}` : ""}
                      {c.relation === "funding" ? " • funding" : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <a
          href={`https://voyager.online/contract/${selectedNode.address}`}
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
