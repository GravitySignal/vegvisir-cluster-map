"use client";

import { useState, useCallback, useRef } from "react";
import type { GraphData, GraphMode } from "@/types";

interface GraphFetchOptions {
  depth: number;
  maxTransfersPerAddress: number;
}

export function useGraphData() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestAbortRef = useRef<AbortController | null>(null);

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
        const depth = Math.min(3, Math.max(1, options?.depth || 2));
        const maxTransfers = Math.min(
          1000,
          Math.max(50, options?.maxTransfersPerAddress || 250)
        );
        const res = await fetch(
          `/api/graph?target=${encodeURIComponent(target)}&limit=${limit}&mode=${mode}&depth=${depth}&maxTransfers=${maxTransfers}`,
          { signal: controller.signal }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to fetch graph data");
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
    []
  );

  return { graphData, isLoading, error, setError, fetchGraph };
}
