"use client";

import { useEffect, useMemo, useState } from "react";
import type { GraphMode } from "@/types";

interface LoadingStateProps {
  isLoading: boolean;
  mode?: GraphMode;
  depth?: number;
  maxTransfersPerAddress?: number;
  action?: "explore" | "expand";
}

const ADDRESS_PHASES = [
  "Resolving account profile",
  "Pulling transfer pages",
  "Linking connected addresses",
  "Detecting clusters and entity labels",
  "Rendering map and token lanes",
];

const TOKEN_PHASES = [
  "Loading token metadata",
  "Fetching top holders",
  "Building transfer links",
  "Rendering bubble map",
];

export default function LoadingState({
  isLoading,
  mode = "address",
  depth = 2,
  maxTransfersPerAddress = 250,
  action = "explore",
}: LoadingStateProps) {
  const [ticks, setTicks] = useState(0);
  const phases = mode === "address" ? ADDRESS_PHASES : TOKEN_PHASES;

  useEffect(() => {
    if (!isLoading) return;
    const timer = setInterval(() => {
      setTicks((value) => value + 1);
    }, 800);
    return () => clearInterval(timer);
  }, [isLoading]);

  const phaseIndex = useMemo(() => {
    return ticks % phases.length;
  }, [ticks, phases.length]);

  if (!isLoading) return null;

  const percent = ((phaseIndex + 1) / phases.length) * 100;

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-gray-900/70 backdrop-blur-sm z-30 transition-opacity duration-200">
      <div className="w-[min(560px,92vw)] border border-cyan-700/40 rounded-2xl bg-slate-950/90 shadow-[0_0_50px_rgba(8,145,178,0.15)] p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div>
            <p className="text-cyan-300 text-xs uppercase tracking-[0.2em]">
              {action === "expand" ? "Expanding Node" : "Exploring Graph"}
            </p>
            <p className="text-white text-base font-semibold mt-1">
              {phases[phaseIndex]}
            </p>
          </div>
          <p className="text-slate-400 text-xs tabular-nums">
            step {phaseIndex + 1}/{phases.length}
          </p>
        </div>

        <div className="h-1.5 rounded-full bg-slate-800 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-400 to-blue-500 transition-all duration-300"
            style={{ width: `${percent}%` }}
          />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
          <span className="px-2 py-0.5 rounded border border-slate-700">mode: {mode}</span>
          {mode === "address" && (
            <>
              <span className="px-2 py-0.5 rounded border border-slate-700">depth: {depth}</span>
              <span className="px-2 py-0.5 rounded border border-slate-700">
                max transfers/address: {maxTransfersPerAddress}
              </span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
