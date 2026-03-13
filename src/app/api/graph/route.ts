import { NextRequest, NextResponse } from "next/server";
import { isValidStarknetAddress } from "@/lib/utils/validation";
import { buildAddressGraphData, buildGraphData } from "@/lib/graph/buildGraph";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const requestApiKey = request.headers.get("x-voyager-api-key")?.trim() || undefined;
  const modeParam = searchParams.get("mode");
  const mode = modeParam === "address" ? "address" : "token";
  const target = searchParams.get("target") || searchParams.get("token");
  const limitParam = searchParams.get("limit");
  const depthParam = searchParams.get("depth");
  const maxTransfersParam = searchParams.get("maxTransfers");

  if (!target) {
    return NextResponse.json({ error: "Missing address/contract input." }, { status: 400 });
  }

  if (!isValidStarknetAddress(target)) {
    return NextResponse.json(
      { error: "Invalid Starknet address (expected 0x followed by 1-64 hex characters)" },
      { status: 400 }
    );
  }

  const limit = Math.min(150, Math.max(10, parseInt(limitParam || "100", 10) || 100));
  const depth = Math.min(5, Math.max(1, parseInt(depthParam || "2", 10) || 2));
  const maxTransfersPerAddress = Math.min(
    1000,
    Math.max(50, parseInt(maxTransfersParam || "250", 10) || 250)
  );

  try {
    const graphData =
      mode === "address"
        ? await buildAddressGraphData(target, limit, {
            depth,
            maxTransfersPerAddress,
          }, requestApiKey)
        : await buildGraphData(target, limit, requestApiKey);
    return NextResponse.json(graphData, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
