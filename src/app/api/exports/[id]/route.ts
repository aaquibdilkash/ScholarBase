import { NextResponse } from "next/server";

import { createClient } from "@/utils/supabase/server";
import { getExportJob } from "@/lib/exports/job";
import { createSignedExportUrl } from "@/lib/exports/storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const job = await getExportJob(id);
  if (!job || job.userId !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  if (job.status !== "DONE" || !job.objectPath) {
    return NextResponse.json({ status: job.status, error: job.error ?? null });
  }

  const signedUrl = await createSignedExportUrl(job.objectPath);
  if (!signedUrl) {
    return NextResponse.json({ error: "Could not create download link" }, { status: 500 });
  }
  return NextResponse.json({ status: "DONE", downloadUrl: signedUrl });
}
