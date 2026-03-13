import { describe, expect, it } from "vitest";
import { classifyEntity } from "@/lib/starknet/entityClassification";

describe("classifyEntity", () => {
  it("classifies bridge aliases as bridge", () => {
    const result = classifyEntity({ alias: "LayerSwap Bridge" });
    expect(result.type).toBe("bridge");
  });

  it("classifies staking aliases as staking", () => {
    const result = classifyEntity({ alias: "STRK Staking Vault" });
    expect(result.type).toBe("staking");
  });

  it("classifies account contract types as individual", () => {
    const result = classifyEntity({ contractType: "Account" });
    expect(result.type).toBe("individual");
  });

  it("classifies explicit token contracts as token", () => {
    const result = classifyEntity({ isToken: true });
    expect(result.type).toBe("token");
  });

  it("defaults to individual when no hints are present", () => {
    const result = classifyEntity({});
    expect(result.type).toBe("individual");
  });
});
