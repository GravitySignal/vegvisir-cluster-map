import { describe, it, expect } from "vitest";
import { prepareNodes, prepareLinks, createSimulation } from "@/lib/graph/simulation";
import type { TokenHolder, TransferEdge, SimulationNode } from "@/types";

function makeHolder(overrides: Partial<TokenHolder> = {}): TokenHolder {
  return {
    address: "0x0001",
    balance: "100",
    balanceFormatted: 100,
    percentSupply: 10,
    rank: 1,
    alias: null,
    ...overrides,
  };
}

describe("prepareNodes", () => {
  it("assigns radius using scaleSqrt between 8 and 60", () => {
    const holders: TokenHolder[] = [
      makeHolder({ address: "0x0001", balanceFormatted: 10 }),
      makeHolder({ address: "0x0002", balanceFormatted: 1000 }),
    ];
    const nodes = prepareNodes(holders);
    expect(nodes).toHaveLength(2);
    // Smallest balance → radius 8, largest → radius 60
    expect(nodes[0].radius).toBe(8);
    expect(nodes[1].radius).toBe(60);
  });

  it("initializes x, y, vx, vy to 0 and fx, fy to null", () => {
    const nodes = prepareNodes([makeHolder()]);
    expect(nodes[0].x).toBe(0);
    expect(nodes[0].y).toBe(0);
    expect(nodes[0].vx).toBe(0);
    expect(nodes[0].vy).toBe(0);
    expect(nodes[0].fx).toBeNull();
    expect(nodes[0].fy).toBeNull();
  });

  it("handles single holder (min === max)", () => {
    const nodes = prepareNodes([makeHolder({ balanceFormatted: 500 })]);
    expect(nodes).toHaveLength(1);
    // With domain [500, 500], d3 scaleSqrt returns midpoint of range
    expect(nodes[0].radius).toBe(34);
  });

  it("preserves original holder properties", () => {
    const holder = makeHolder({ address: "0xabc", alias: "Test Alias", rank: 5 });
    const nodes = prepareNodes([holder]);
    expect(nodes[0].address).toBe("0xabc");
    expect(nodes[0].alias).toBe("Test Alias");
    expect(nodes[0].rank).toBe(5);
  });
});

describe("prepareLinks", () => {
  const nodes: SimulationNode[] = [
    { ...makeHolder({ address: "0x0001" }), x: 0, y: 0, vx: 0, vy: 0, fx: null, fy: null, radius: 20 },
    { ...makeHolder({ address: "0x0002" }), x: 0, y: 0, vx: 0, vy: 0, fx: null, fy: null, radius: 30 },
  ];

  it("filters edges to only include nodes in the set", () => {
    const edges: TransferEdge[] = [
      { from: "0x0001", to: "0x0002", volume: 100, txCount: 5 },
      { from: "0x0001", to: "0x9999", volume: 200, txCount: 3 }, // 0x9999 not in nodes
    ];
    const links = prepareLinks(edges, nodes);
    expect(links).toHaveLength(1);
    expect(links[0].source).toBe("0x0001");
    expect(links[0].target).toBe("0x0002");
  });

  it("assigns thickness using scaleLinear between 0.5 and 6", () => {
    const edges: TransferEdge[] = [
      { from: "0x0001", to: "0x0002", volume: 10, txCount: 1 },
      { from: "0x0002", to: "0x0001", volume: 1000, txCount: 10 },
    ];
    const links = prepareLinks(edges, nodes);
    expect(links).toHaveLength(2);
    expect(links[0].thickness).toBe(0.5);
    expect(links[1].thickness).toBe(6);
  });

  it("returns empty array when no valid edges exist", () => {
    const edges: TransferEdge[] = [
      { from: "0x9999", to: "0x8888", volume: 100, txCount: 1 },
    ];
    const links = prepareLinks(edges, nodes);
    expect(links).toHaveLength(0);
  });

  it("returns empty array for empty edges input", () => {
    const links = prepareLinks([], nodes);
    expect(links).toHaveLength(0);
  });
});

describe("createSimulation", () => {
  const nodes: SimulationNode[] = [
    { ...makeHolder({ address: "0x0001" }), x: 0, y: 0, vx: 0, vy: 0, fx: null, fy: null, radius: 20 },
    { ...makeHolder({ address: "0x0002" }), x: 0, y: 0, vx: 0, vy: 0, fx: null, fy: null, radius: 30 },
  ];

  it("returns a simulation with configured forces", () => {
    const sim = createSimulation(nodes, [], 800, 600);
    expect(sim).toBeDefined();
    expect(sim.force("link")).toBeDefined();
    expect(sim.force("charge")).toBeDefined();
    expect(sim.force("center")).toBeDefined();
    expect(sim.force("collide")).toBeDefined();
    sim.stop();
  });

  it("sets alphaDecay and velocityDecay correctly", () => {
    const sim = createSimulation(nodes, [], 800, 600);
    expect(sim.alphaDecay()).toBe(0.02);
    expect(sim.velocityDecay()).toBe(0.4);
    sim.stop();
  });

  it("uses correct number of nodes", () => {
    const sim = createSimulation(nodes, [], 800, 600);
    expect(sim.nodes()).toHaveLength(2);
    sim.stop();
  });
});
