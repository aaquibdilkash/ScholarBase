import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import { checkRateLimit, RATE_LIMIT_DEGRADED_ERROR, RATE_LIMIT_ERROR } from "@/lib/rate-limit";
import { createExportJob } from "@/lib/exports/job";
import { queueExportJob } from "@/lib/exports/qstash";
import { ExportJobKind } from "@prisma/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const triggerSchema = z.object({
  kind: z.enum(["SURVEY", "NETNOKIT"]),
  params: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await checkRateLimit({
    namespace: "exports:trigger",
    key: user.id,
    limit: 10,
    window: "10 m",
    onDegraded: "closed",
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: limit.degraded ? RATE_LIMIT_DEGRADED_ERROR : RATE_LIMIT_ERROR },
      { status: limit.degraded ? 503 : 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }
  const parsed = triggerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const kind = parsed.data.kind as ExportJobKind;
  const params = { ...parsed.data.params };

  // Survey exports require ownership/shareData checks at trigger time too, so
  // the worker can fail fast rather than after a long queue wait. Full authz
  // is re-checked in the worker.
  if (kind === "SURVEY") {
    const surveyId = String(params.surveyId ?? "");
    if (!surveyId) return NextResponse.json({ error: "surveyId required" }, { status: 400 });
  }

  const job = await createExportJob(user.id, kind, params);
  try {
    await queueExportJob(job.id);
  } catch (e) {
    // If we can't enqueue, fail the job so the client isn't left polling forever.
    const { markExportJobFailed } = await import("@/lib/exports/job");
    await markExportJobFailed(job.id, e instanceof Error ? e.message : "Enqueue failed");
    return NextResponse.json({ error: "Could not queue export" }, { status: 503 });
  }

  return NextResponse.json({ jobId: job.id, status: "queued" }, { status: 202 });
}
