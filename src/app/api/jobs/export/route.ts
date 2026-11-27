import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { NextResponse } from "next/server";

import { processExportJob } from "@/lib/exports/processor";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handler(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }
  const jobId = (body as { jobId?: string })?.jobId;
  if (!jobId || typeof jobId !== "string") {
    return NextResponse.json({ error: "jobId required" }, { status: 400 });
  }

  try {
    await processExportJob(jobId);
    return NextResponse.json({ status: "DONE" }, { status: 200 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Export failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export const POST = verifySignatureAppRouter(handler);
