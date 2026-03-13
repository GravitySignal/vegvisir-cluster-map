import type { EntityType } from "@/types";

interface ClassificationInput {
  alias?: string | null;
  name?: string | null;
  contractType?: string | null;
  isToken?: boolean;
}

interface EntityClassification {
  type: EntityType;
  label: string;
  description: string;
}

const KEYWORDS: Record<Exclude<EntityType, "individual" | "token" | "contract" | "unknown">, string[]> = {
  bridge: ["bridge", "wormhole", "layerswap", "orbiter", "rhino"],
  staking: ["stake", "staking", "validator", "delegat", "yield"],
  service: ["service", "paymaster", "router", "relayer", "multisig", "deployer", "treasury"],
  app: ["app", "dex", "swap", "amm", "market", "protocol", "vault", "game"],
};

export function entityLabel(type: EntityType): string {
  switch (type) {
    case "individual":
      return "Individual";
    case "app":
      return "App";
    case "service":
      return "Service";
    case "bridge":
      return "Bridge";
    case "staking":
      return "Staking";
    case "token":
      return "Token";
    case "contract":
      return "Contract";
    default:
      return "Unknown";
  }
}

function normalize(text: string | null | undefined): string {
  return (text || "").trim().toLowerCase();
}

function includesAny(text: string, keywords: string[]): boolean {
  return keywords.some((keyword) => text.includes(keyword));
}

export function classifyEntity(input: ClassificationInput): EntityClassification {
  if (input.isToken) {
    return {
      type: "token",
      label: entityLabel("token"),
      description: "Token contract.",
    };
  }

  const combined = [input.alias, input.name, input.contractType]
    .map(normalize)
    .filter(Boolean)
    .join(" ");

  const contractType = normalize(input.contractType);

  if (includesAny(combined, KEYWORDS.bridge)) {
    return {
      type: "bridge",
      label: entityLabel("bridge"),
      description: "Bridge-related contract or address.",
    };
  }

  if (includesAny(combined, KEYWORDS.staking)) {
    return {
      type: "staking",
      label: entityLabel("staking"),
      description: "Staking contract or staking service address.",
    };
  }

  if (includesAny(combined, KEYWORDS.service)) {
    return {
      type: "service",
      label: entityLabel("service"),
      description: "Infrastructure/service contract.",
    };
  }

  if (includesAny(combined, KEYWORDS.app)) {
    return {
      type: "app",
      label: entityLabel("app"),
      description: "Application-level contract (for example DEX/game/protocol).",
    };
  }

  if (contractType.includes("account")) {
    return {
      type: "individual",
      label: entityLabel("individual"),
      description: "Account contract, likely an individual wallet.",
    };
  }

  if (!combined) {
    return {
      type: "individual",
      label: entityLabel("individual"),
      description: "No contract signature detected; likely an individual account.",
    };
  }

  if (normalize(input.alias) || normalize(input.name)) {
    return {
      type: "app",
      label: entityLabel("app"),
      description: "Named contract or app address.",
    };
  }

  if (contractType.includes("contract")) {
    return {
      type: "contract",
      label: entityLabel("contract"),
      description: "Smart contract address.",
    };
  }

  return {
    type: "unknown",
    label: entityLabel("unknown"),
    description: "Unclassified address.",
  };
}

export function entityColor(type: EntityType): string {
  switch (type) {
    case "individual":
      return "#22c55e";
    case "app":
      return "#3b82f6";
    case "service":
      return "#f97316";
    case "bridge":
      return "#06b6d4";
    case "staking":
      return "#eab308";
    case "token":
      return "#a855f7";
    case "contract":
      return "#94a3b8";
    default:
      return "#6b7280";
  }
}
