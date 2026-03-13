export type GraphMode = "token" | "address";

export type EntityType =
  | "individual"
  | "app"
  | "service"
  | "bridge"
  | "staking"
  | "token"
  | "contract"
  | "unknown";

export interface TokenHolder {
  address: string;
  balance: string;          // Raw balance string from API
  balanceFormatted: number; // Parsed float for display and sizing
  percentSupply: number;    // Percentage of total supply (0-100)
  rank: number;
  alias: string | null;     // contractAlias from Voyager
  entityType?: EntityType;
  entityLabel?: string;
  entityDescription?: string;
  isFocus?: boolean;
  interactionTxCount?: number;
  incomingTxCount?: number;
  outgoingTxCount?: number;
  incomingVolume?: number;
  outgoingVolume?: number;
}

export interface TransferEdge {
  from: string;
  to: string;
  volume: number;
  txCount: number;
  relation?: "interaction" | "funding";
  tokenAddress?: string;
  tokenSymbol?: string | null;
}

export interface TokenMetadata {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: number;
}

export interface GraphData {
  mode: GraphMode;
  focusAddress: string;
  token: TokenMetadata;
  nodes: TokenHolder[];
  edges: TransferEdge[];
  metadata: {
    holdersCount: number;
    edgesCount: number;
    fetchedAt: string;
    entityCounts?: Partial<Record<EntityType, number>>;
    note?: string;
    exploration?: {
      depth: number;
      processedAddresses: number;
      maxTransfersPerAddress: number;
    };
    tokenLegend?: Array<{
      tokenAddress: string;
      tokenSymbol: string;
      color: string;
    }>;
  };
  funding?: {
    totalIncomingTxCount: number;
    totalIncomingVolume: number;
    sources: Array<{
      address: string;
      alias: string | null;
      entityType: EntityType;
      entityLabel?: string;
      volume: number;
      txCount: number;
      tokenSymbol?: string | null;
    }>;
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
  relation?: "interaction" | "funding";
  tokenAddress?: string;
  tokenSymbol?: string | null;
}
