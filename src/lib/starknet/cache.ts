import type { GraphData } from "@/types";

const cache = new Map<string, { data: GraphData; timestamp: number }>();
const TTL = 5 * 60 * 1000; // 5 minutes

export function getCached(key: string): GraphData | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > TTL) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

export function setCache(key: string, data: GraphData): void {
  cache.set(key, { data, timestamp: Date.now() });
}
