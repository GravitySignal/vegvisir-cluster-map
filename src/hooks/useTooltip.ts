"use client";

import { useState, useCallback } from "react";
import type { SimulationNode } from "@/types";

export function useTooltip() {
  const [tooltipNode, setTooltipNode] = useState<SimulationNode | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);

  const handleNodeHover = useCallback(
    (node: SimulationNode | null, event?: MouseEvent) => {
      setTooltipNode(node);
      if (node && event) {
        setTooltipPos({ x: event.clientX, y: event.clientY });
      } else {
        setTooltipPos(null);
      }
    },
    []
  );

  return { tooltipNode, tooltipPos, handleNodeHover };
}
