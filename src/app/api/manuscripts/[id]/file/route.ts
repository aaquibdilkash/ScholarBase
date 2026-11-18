import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import { MANUSCRIPT_BUCKET } from "@/lib/publishing/constants";
import {
  canReadManuscriptFile,
  getManuscriptPermissions,
} from "@/lib/publishing/access";
import { createServiceClient } from "@/utils/supabase/service";

/**
 * Private manuscript PDF for the people reviewing it.
 *
 * `/api/papers/[id]/file` is the *public* version of record and only answers for
 * `PUBLISHED` papers at published venues. Before publication the bytes must
 * still reach the author, the assigned reviewers, and the desk — otherwise peer
 * review is impossible. This route is that door, and it mints the same
 * short-lived signed URL rather than proxying 25 MB through Node.
 */

export const dynamic = "force-dynamic";

const SIGNED_URL_TTL_SECONDS = 60;

function denied() {
  return new NextResponse("Not found", {
    status: 404,
    headers: { "Cache-Control": "private, no-store" },
  });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getCurrentUser();
  if (!user) return denied();

  const { id } = await params;

  // Latest file from the current round: a revision supersedes the round before
  // it, and reviewers must read the version they were asked to assess.
  const manuscript = await prisma.manuscript.findUnique({
    where: { id },
    select: {
      id: true,
      venueId: true,
      authorId: true,
      round: true,
      files: {
        where: { kind: "MANUSCRIPT" },
        orderBy: [{ round: "desc" }, { createdAt: "desc" }],
        take: 1,
        select: { filePath: true },
      },
    },
  });

  if (!manuscript) return denied();

  const permissions = await getManuscriptPermissions(user.id, manuscript);
  if (!canReadManuscriptFile(permissions)) return denied();

  const path = manuscript.files[0]?.filePath;
  if (!path) return denied();

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
