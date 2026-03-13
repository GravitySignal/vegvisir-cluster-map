export interface TokenHolder {
  address: string;
  balance: string;          // Raw balance string from API
  balanceFormatted: number; // Parsed float for display and sizing
  percentSupply: number;    // Percentage of total supply (0-100)
  rank: number;
  alias: string | null;     // contractAlias from Voyager
}

export interface TransferEdge {
  from: string;
  to: string;
  volume: number;
  txCount: number;
}

export interface TokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: number;
}

export interface GraphData {
  token: TokenMetadata;
  nodes: TokenHolder[];
  edges: TransferEdge[];
  metadata: {
    holdersCount: number;
    edgesCount: number;
    fetchedAt: string;
  };
}

export interface SimulationNode extends TokenHolder {
  x: number;
  y: number;
  vx: number;
  vy: number;
  fx: number | null;
  fy: number | null;
  radius: number;
}

export interface SimulationLink {
  source: SimulationNode | string;
  target: SimulationNode | string;
  volume: number;
  thickness: number;
}
