import { NextResponse } from "next/server";
import { z } from "zod";

import prisma from "@/lib/db";
import { isUserAdmin } from "@/lib/auth";
import { createClient } from "@/utils/supabase/server";
import { checkRateLimit, RATE_LIMIT_DEGRADED_ERROR, RATE_LIMIT_ERROR } from "@/lib/rate-limit";
import { createExportJob } from "@/lib/exports/job";
import { queueExportJob } from "@/lib/exports/qstash";

export const dynamic = "force-dynamic";

const querySchema = z.object({
  format: z.enum(["csv", "xlsx"]).default("xlsx"),
});

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const exportLimit = await checkRateLimit({
    namespace: "survey:export",
    key: user.id,
    limit: 5,
    window: "10 m",
    onDegraded: "closed",
  });
  if (!exportLimit.allowed) {
    if (exportLimit.degraded) {
      return NextResponse.json({ error: RATE_LIMIT_DEGRADED_ERROR }, { status: 503 });
    }
    return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });
  }

  const url = new URL(request.url);
  const parsed = querySchema.safeParse({ format: url.searchParams.get("format") ?? "xlsx" });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid format" }, { status: 400 });
  }
  const format = parsed.data.format;

  const survey = await prisma.researchSurvey.findUnique({
    where: { id },
    select: { authorId: true, shareData: true },
  });
  if (!survey) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isAdmin = await isUserAdmin(user.id);
  const isOwner = survey.authorId === user.id;
  if (!isOwner && !isAdmin && !survey.shareData) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const anonymize = !isOwner && !isAdmin;

  const job = await createExportJob(user.id, "SURVEY", {
    surveyId: id,
    format,
    anonymize,
  });

  try {
    await queueExportJob(job.id);
  } catch (e) {
    const { markExportJobFailed } = await import("@/lib/exports/job");
    await markExportJobFailed(job.id, e instanceof Error ? e.message : "Enqueue failed");
    return NextResponse.json({ error: "Could not queue export" }, { status: 503 });
  }

  return NextResponse.json(
    { jobId: job.id, status: "queued" },
    { status: 202, headers: { "Cache-Control": "no-store" } },
  );
}
