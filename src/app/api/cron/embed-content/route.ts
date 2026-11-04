import { NextRequest, NextResponse } from "next/server";

import { verifyCronSecret } from "@/lib/cron";
import { runEmbeddingWorker } from "@/lib/semantic/worker";

// The ONNX runtime is native Node code, and the model download must happen at
// runtime, never during `next build` or a prerender.
export const runtime = "nodejs";
export const revalidate = 0;

function parseLimit(value: string | null): number | undefined {
  if (!value) {
    return undefined;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export async function GET(request: NextRequest) {
  if (!(await verifyCronSecret())) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await runEmbeddingWorker({
      limit: parseLimit(request.nextUrl.searchParams.get("limit")),
    });

    if (result.modelUnavailable) {
      console.error(
        "[cron/embed-content] embedding model unavailable:",
        result.modelUnavailable,
      );

      return NextResponse.json(
        {
          success: false,
          error: "Embedding model unavailable; jobs left queued",
          ...result,
        },
        { status: 503 },
      );
    }

    return NextResponse.json({ success: result.failed === 0, ...result });
  } catch (error) {
    console.error("[cron/embed-content]", error);
    return NextResponse.json(
      { success: false, error: "Embedding batch failed" },
      { status: 500 },
    );
  }
}
