import { NextRequest, NextResponse } from "next/server";
import { isValidStarknetAddress } from "@/lib/utils/validation";
import { buildGraphData } from "@/lib/graph/buildGraph";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token");
  const limitParam = searchParams.get("limit");

  if (!token) {
    return NextResponse.json({ error: "Missing 'token' query parameter" }, { status: 400 });
  }

  if (!isValidStarknetAddress(token)) {
    return NextResponse.json(
      { error: "Invalid Starknet address (expected 0x followed by 1-64 hex characters)" },
      { status: 400 }
    );
  }

  const limit = Math.min(150, Math.max(10, parseInt(limitParam || "100", 10) || 100));

  try {
    const graphData = await buildGraphData(token, limit);
    return NextResponse.json(graphData, {
      headers: { "Cache-Control": "public, max-age=300" },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
