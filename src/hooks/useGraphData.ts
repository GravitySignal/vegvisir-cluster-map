"use client";

import { useState, useCallback } from "react";
import type { GraphData } from "@/types";

export function useGraphData() {
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async (target: string, limit: number, mode: "token" | "address") => {
    setIsLoading(true);
    setError(null);
    setGraphData(null);
    try {
      const res = await fetch(
        `/api/graph?target=${encodeURIComponent(target)}&limit=${limit}&mode=${mode}`
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch graph data");
      setGraphData(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { graphData, isLoading, error, setError, fetchGraph };
}
