import { NextResponse } from "next/server";

import { MANUSCRIPT_BUCKET } from "@/lib/publishing/constants";
import { getPublishedPdfPath } from "@/lib/publishing/public";
import { createServiceClient } from "@/utils/supabase/service";

/**
 * Download endpoint for the version of record.
 *
 * The `manuscripts` bucket is private and has no storage policies, so a public
 * article cannot link to a durable object URL. This route checks that the
 * manuscript is `PUBLISHED` and that its venue is published, then redirects to a
 * 60-second signed URL. The bytes never pass through the app, so a download
 * costs one DB lookup and one signed-URL mint rather than 25 MB of Node memory.
 *
 * A redirect (rather than a proxy) also keeps range requests and resume working:
 * the browser talks to Storage directly.
 */

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 60;

function notFound() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const path = await getPublishedPdfPath(id);
  if (!path) return notFound();

  let signedUrl: string | null = null;
  try {
    const { data, error } = await createServiceClient()
      .storage.from(MANUSCRIPT_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);

    signedUrl = error ? null : (data?.signedUrl ?? null);
  } catch {
    signedUrl = null;
  }

  if (!signedUrl) {
    return new NextResponse("The file is temporarily unavailable.", {
      status: 503,
      headers: { "Cache-Control": "private, no-store" },
    });
  }

  return NextResponse.redirect(signedUrl, {
    status: 302,
    headers: { "Cache-Control": "private, no-store" },
  });
}
