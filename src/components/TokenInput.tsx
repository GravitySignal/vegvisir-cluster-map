"use client";

import { useState, FormEvent, useEffect } from "react";
import { isValidStarknetAddress } from "@/lib/utils/validation";
import { truncateAddress } from "@/lib/utils/format";
import type { GraphMode } from "@/types";

const QUICK_TOKENS = [
  { label: "STRK", address: "0x04718f5a0fc34cc1af16a1cdee98ffb20c31f5cd61d6ab07201858f4287c938d" },
  { label: "ETH", address: "0x049d36570d4e46f48e99674bd3fcc84644ddd6b96f7c741b1562b82f9e004dc7" },
];

const SETTINGS_KEY = "vegvisir_bubblemap_settings";

function readInitialSettings(): {
  limit: number;
  depth: number;
  maxTransfersPerAddress: number;
  voyagerApiKey: string;
} {
  if (typeof window === "undefined") {
    return { limit: 80, depth: 2, maxTransfersPerAddress: 250, voyagerApiKey: "" };
  }

  try {
    const storage = window.localStorage as Partial<Storage> | undefined;
    if (!storage || typeof storage.getItem !== "function") {
      return { limit: 80, depth: 2, maxTransfersPerAddress: 250, voyagerApiKey: "" };
    }
    const raw = storage.getItem(SETTINGS_KEY);
    if (!raw) {
      return { limit: 80, depth: 2, maxTransfersPerAddress: 250, voyagerApiKey: "" };
    }
    const parsed = JSON.parse(raw) as {
      limit?: number;
      depth?: number;
      maxTransfersPerAddress?: number;
      voyagerApiKey?: string;
    };
    return {
      limit: Math.min(150, Math.max(10, parsed.limit || 80)),
      depth: Math.min(5, Math.max(1, parsed.depth || 2)),
      maxTransfersPerAddress: Math.min(
        1000,
        Math.max(50, parsed.maxTransfersPerAddress || 250)
      ),
      voyagerApiKey: (parsed.voyagerApiKey || "").trim(),
    };
  } catch {
    return { limit: 80, depth: 2, maxTransfersPerAddress: 250, voyagerApiKey: "" };
  }
}

interface TokenInputProps {
  onSubmit: (
    address: string,
    limit: number,
    mode: GraphMode,
    options?: { depth: number; maxTransfersPerAddress: number; voyagerApiKey?: string }
  ) => void;
  isLoading: boolean;
}

export default function TokenInput({ onSubmit, isLoading }: TokenInputProps) {
  const initialSettings = readInitialSettings();
  const [address, setAddress] = useState("");
  const [limit, setLimit] = useState(initialSettings.limit);
  const [mode, setMode] = useState<GraphMode>("address");
  const [depth, setDepth] = useState(initialSettings.depth);
  const [maxTransfersPerAddress, setMaxTransfersPerAddress] = useState(
    initialSettings.maxTransfersPerAddress
  );
  const [voyagerApiKey, setVoyagerApiKey] = useState(initialSettings.voyagerApiKey);
  const [error, setError] = useState<string | null>(null);

  const isAddressMode = mode === "address";

  useEffect(() => {
    const storage = window.localStorage as Partial<Storage> | undefined;
    if (!storage || typeof storage.setItem !== "function") return;
    storage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ limit, depth, maxTransfersPerAddress, voyagerApiKey })
    );
  }, [limit, depth, maxTransfersPerAddress, voyagerApiKey]);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = address.trim();
    if (!trimmed) {
      setError(
        isAddressMode
          ? "Please enter a Starknet address"
          : "Please enter a token contract address"
      );
      return;
    }
    if (!isValidStarknetAddress(trimmed)) {
      setError("Invalid Starknet address (expected 0x followed by 1-64 hex characters)");
      return;
    }
    setError(null);
    const key = voyagerApiKey.trim();
    const submitOptions = {
      depth,
      maxTransfersPerAddress,
      ...(key ? { voyagerApiKey: key } : {}),
    };
    onSubmit(trimmed, limit, mode, {
      ...submitOptions,
    });
  }

  function handleQuickSelect(addr: string) {
    setMode("token");
    setAddress(addr);
    setError(null);
    const key = voyagerApiKey.trim();
    const submitOptions = {
      depth,
      maxTransfersPerAddress,
      ...(key ? { voyagerApiKey: key } : {}),
    };
    onSubmit(addr, limit, "token", {
      ...submitOptions,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 w-full">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setMode("address")}
          disabled={isLoading}
          className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${
            isAddressMode
              ? "bg-blue-600/20 border-blue-500 text-blue-300"
              : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
          }`}
        >
          Address graph
        </button>
        <button
          type="button"
          onClick={() => setMode("token")}
          disabled={isLoading}
          className={`px-3 py-1.5 rounded-md border text-xs transition-colors ${
            !isAddressMode
              ? "bg-blue-600/20 border-blue-500 text-blue-300"
              : "bg-gray-800 border-gray-700 text-gray-300 hover:bg-gray-700"
          }`}
        >
          Token holder map
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-end">
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={address}
            onChange={(e) => {
              setAddress(e.target.value);
              setError(null);
            }}
            placeholder={
              isAddressMode
                ? "Enter Starknet address (wallet/app/contract)"
                : "Enter token contract address (ERC-20)"
            }
            className="w-full px-4 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-gray-400 text-sm whitespace-nowrap">
            {isAddressMode ? "Max nodes:" : "Max holders:"}
          </label>
          <input
            type="number"
            value={limit}
            onChange={(e) => setLimit(Math.min(150, Math.max(10, Number(e.target.value))))}
            min={10}
            max={150}
            className="w-20 px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            disabled={isLoading}
          />
        </div>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors shrink-0"
        >
          {isLoading ? "Loading..." : "Explore"}
        </button>
      </div>

      {isAddressMode && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-sm whitespace-nowrap">Depth:</label>
            <select
              value={depth}
              onChange={(e) => setDepth(Math.min(5, Math.max(1, Number(e.target.value))))}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={isLoading}
            >
              <option value={1}>1 hop (fast)</option>
              <option value={2}>2 hops (default)</option>
              <option value={3}>3 hops (deep)</option>
              <option value={4}>4 hops (very deep)</option>
              <option value={5}>5 hops (forensics)</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-400 text-sm whitespace-nowrap">Max transfers/address:</label>
            <input
              type="number"
              value={maxTransfersPerAddress}
              onChange={(e) =>
                setMaxTransfersPerAddress(Math.min(1000, Math.max(50, Number(e.target.value))))
              }
              min={50}
              max={1000}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              disabled={isLoading}
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2">
        <label className="text-gray-400 text-sm whitespace-nowrap">Voyager API key:</label>
        <input
          type="password"
          value={voyagerApiKey}
          onChange={(e) => setVoyagerApiKey(e.target.value)}
          placeholder="Paste Voyager key (stored locally)"
          className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          disabled={isLoading}
        />
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      {!isAddressMode && (
        <div className="flex gap-2 items-center">
          <span className="text-gray-500 text-xs">Quick select:</span>
          {QUICK_TOKENS.map((token) => (
            <button
              key={token.label}
              type="button"
              onClick={() => handleQuickSelect(token.address)}
              disabled={isLoading}
              className="px-3 py-1 bg-gray-800 hover:bg-gray-700 disabled:opacity-50 border border-gray-700 rounded text-xs text-gray-300 transition-colors"
            >
              {token.label} ({truncateAddress(token.address)})
            </button>
          ))}
        </div>
      )}
    </form>
  );
}
