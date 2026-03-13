"use client";

import { useRef, useEffect, memo } from "react";
import { select } from "d3-selection";
import { zoom, zoomIdentity } from "d3-zoom";
import { drag as d3Drag } from "d3-drag";
import {
  prepareNodes,
  prepareLinks,
  createSimulation,
} from "@/lib/graph/simulation";
import { entityColor } from "@/lib/starknet/entityClassification";
import { getTokenColor } from "@/lib/utils/tokenColor";
import { truncateAddress } from "@/lib/utils/format";
import type { GraphData, SimulationNode, SimulationLink } from "@/types";

interface BubbleMapProps {
  graphData: GraphData;
  onNodeHover?: (node: SimulationNode | null, event?: MouseEvent) => void;
  onNodeClick?: (node: SimulationNode) => void;
  onNodeDoubleClick?: (node: SimulationNode) => void;
  expandedAddresses?: Set<string>;
}

function BubbleMapInner({
  graphData,
  onNodeHover,
  onNodeClick,
  onNodeDoubleClick,
  expandedAddresses,
}: BubbleMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const simulationRef = useRef<ReturnType<typeof createSimulation> | null>(null);
  const onNodeHoverRef = useRef(onNodeHover);
  const onNodeClickRef = useRef(onNodeClick);
  const onNodeDoubleClickRef = useRef(onNodeDoubleClick);
  onNodeHoverRef.current = onNodeHover;
  onNodeClickRef.current = onNodeClick;
  onNodeDoubleClickRef.current = onNodeDoubleClick;

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight;
    if (width === 0 || height === 0) return;

    // Clear previous
    select(container).select("svg").remove();
    if (simulationRef.current) {
      simulationRef.current.stop();
      simulationRef.current = null;
    }

    // Prepare data
    const nodes = prepareNodes(graphData.nodes);
    const links = prepareLinks(graphData.edges, nodes);

    // Create SVG
    const svg = select(container)
      .append("svg")
      .attr("width", width)
      .attr("height", height)
      .style("cursor", "grab");

    const g = svg.append("g");

    // Zoom behavior
    const zoomBehavior = zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 10])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    svg.call(zoomBehavior);
    svg.on("dblclick.zoom", () => {
      svg.call(zoomBehavior.transform, zoomIdentity);
    });

    // Render edges
    const linkSelection = g
      .append("g")
      .attr("class", "edges")
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke", (d: SimulationLink) => {
        if (graphData.mode === "address") {
          return getTokenColor(d.tokenAddress, d.tokenSymbol);
        }
        return d.relation === "funding" ? "rgba(34, 197, 94, 0.45)" : "rgba(59, 130, 246, 0.3)";
      })
      .attr("stroke-width", (d: SimulationLink) => d.thickness)
      .attr("stroke-opacity", 0.5)
      .attr("stroke-dasharray", (d: SimulationLink) => (d.relation === "funding" ? "3,2" : null))
      .attr("stroke-linecap", "round");

    // Render nodes
    const nodeSelection = g
      .append("g")
      .attr("class", "nodes")
      .selectAll("circle")
      .data(nodes)
      .join("circle")
      .attr("r", (d: SimulationNode) => d.radius)
      .attr("fill", (d: SimulationNode) => entityColor(d.entityType || "unknown"))
      .attr("stroke", (d: SimulationNode) => (d.isFocus ? "white" : "transparent"))
      .attr("stroke-width", 2)
      .attr("stroke-dasharray", (d: SimulationNode) => {
        if (!expandedAddresses || graphData.mode !== "address") return null;
        if (d.isFocus) return null;
        return expandedAddresses.has(d.address) ? null : "4,3";
      })
      .attr("opacity", (d: SimulationNode) => (d.entityType === "individual" ? 1 : 0.88))
      .style("cursor", "pointer");

    // Labels for top 10
    const labelSelection = g
      .append("g")
      .attr("class", "labels")
      .selectAll("text")
      .data(nodes.filter((n) => n.rank <= 10))
      .join("text")
      .text((d: SimulationNode) =>
        d.alias || truncateAddress(d.address)
      )
      .attr("text-anchor", "middle")
      .attr("fill", "white")
      .attr("font-size", 10)
      .attr("dy", (d: SimulationNode) => d.radius + 14)
      .style("pointer-events", "none");

    // Hover events
    nodeSelection
      .on("mouseenter", function (event: MouseEvent, d: SimulationNode) {
        select(this).attr("stroke", "white").attr("stroke-width", 2);
        // Highlight connected edges
        linkSelection.attr("stroke-opacity", (l: SimulationLink) => {
          const src =
            typeof l.source === "string"
              ? l.source
              : (l.source as SimulationNode).address;
          const tgt =
            typeof l.target === "string"
              ? l.target
              : (l.target as SimulationNode).address;
          return src === d.address || tgt === d.address ? 0.8 : 0.15;
        });
        onNodeHoverRef.current?.(d, event);
      })
      .on("mousemove", function (event: MouseEvent, d: SimulationNode) {
        onNodeHoverRef.current?.(d, event);
      })
      .on("mouseleave", function (_event: MouseEvent, d: SimulationNode) {
        select(this).attr("stroke", d.isFocus ? "white" : "transparent");
        linkSelection.attr("stroke-opacity", 1);
        onNodeHoverRef.current?.(null);
      });

    // Click events
    nodeSelection.on("click", function (_event: MouseEvent, d: SimulationNode) {
      onNodeClickRef.current?.(d);
    });
    nodeSelection.on("dblclick", function (event: MouseEvent, d: SimulationNode) {
      event.stopPropagation();
      onNodeDoubleClickRef.current?.(d);
    });

    // Drag behavior
    const dragBehavior = d3Drag<SVGCircleElement, SimulationNode>()
      .on("start", (event, d) => {
        if (!event.active) simulation.alphaTarget(0.3).restart();
        d.fx = d.x;
        d.fy = d.y;
      })
      .on("drag", (event, d) => {
        d.fx = event.x;
        d.fy = event.y;
      })
      .on("end", (event, d) => {
        if (!event.active) simulation.alphaTarget(0);
        d.fx = null;
        d.fy = null;
      });

    nodeSelection.call(dragBehavior as never);

    // Force simulation
    const simulation = createSimulation(nodes, links, width, height);
    simulationRef.current = simulation;

    simulation.on("tick", () => {
      linkSelection
        .attr("x1", (d: SimulationLink) =>
          typeof d.source === "string" ? 0 : (d.source as SimulationNode).x
        )
        .attr("y1", (d: SimulationLink) =>
          typeof d.source === "string" ? 0 : (d.source as SimulationNode).y
        )
        .attr("x2", (d: SimulationLink) =>
          typeof d.target === "string" ? 0 : (d.target as SimulationNode).x
        )
        .attr("y2", (d: SimulationLink) =>
          typeof d.target === "string" ? 0 : (d.target as SimulationNode).y
        );

      nodeSelection
        .attr("cx", (d: SimulationNode) => d.x)
        .attr("cy", (d: SimulationNode) => d.y);

      labelSelection
        .attr("x", (d: SimulationNode) => d.x)
        .attr("y", (d: SimulationNode) => d.y);
    });

    return () => {
      simulation.stop();
      select(container).select("svg").remove();
    };
  }, [graphData, expandedAddresses]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full min-h-[400px]"
    />
  );
}

const BubbleMap = memo(BubbleMapInner);
export default BubbleMap;
