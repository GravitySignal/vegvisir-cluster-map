import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type Simulation,
  type SimulationLinkDatum,
} from "d3-force";
import { scaleSqrt, scaleLinear } from "d3-scale";
import type { SimulationNode, SimulationLink, TokenHolder, TransferEdge } from "@/types";

export function prepareNodes(holders: TokenHolder[]): SimulationNode[] {
  const balances = holders.map((h) => h.balanceFormatted);
  const min = Math.min(...balances);
  const max = Math.max(...balances);
  const radiusScale = scaleSqrt()
    .domain([min, max || 1])
    .range([8, 60]);

  return holders.map((h) => ({
    ...h,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    fx: null,
    fy: null,
    radius: radiusScale(h.balanceFormatted),
  }));
}

export function prepareLinks(
  edges: TransferEdge[],
  nodes: SimulationNode[]
): SimulationLink[] {
  const nodeSet = new Set(nodes.map((n) => n.address));
  const validEdges = edges.filter(
    (e) => nodeSet.has(e.from) && nodeSet.has(e.to)
  );

  if (validEdges.length === 0) return [];

  const volumes = validEdges.map((e) => e.volume);
  const minVol = Math.min(...volumes);
  const maxVol = Math.max(...volumes);
  const thicknessScale = scaleLinear()
    .domain([minVol, maxVol || 1])
    .range([0.5, 6]);

  return validEdges.map((e) => ({
    source: e.from,
    target: e.to,
    volume: e.volume,
    thickness: thicknessScale(e.volume),
    relation: e.relation,
    tokenAddress: e.tokenAddress,
    tokenSymbol: e.tokenSymbol,
  }));
}

export function createSimulation(
  nodes: SimulationNode[],
  links: SimulationLink[],
  width: number,
  height: number
): Simulation<SimulationNode, SimulationLink & SimulationLinkDatum<SimulationNode>> {
  const sim = forceSimulation<SimulationNode>(nodes)
    .force(
      "link",
      forceLink<SimulationNode, SimulationLink & SimulationLinkDatum<SimulationNode>>(
        links as (SimulationLink & SimulationLinkDatum<SimulationNode>)[]
      )
        .id((d) => d.address)
        .distance(100)
        .strength(0.3)
    )
    .force(
      "charge",
      forceManyBody<SimulationNode>().strength(-200).distanceMax(500)
    )
    .force("center", forceCenter(width / 2, height / 2))
    .force(
      "collide",
      forceCollide<SimulationNode>()
        .radius((d) => d.radius + 4)
        .strength(0.8)
    )
    .alphaDecay(0.02)
    .velocityDecay(0.4);

  return sim;
}
