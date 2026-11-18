"use server";

import type { PublicationNoticeType } from "@prisma/client";
import { revalidatePath } from "next/cache";

import prisma from "@/lib/db";
import { getActiveUser, isUserAdmin } from "@/lib/auth";
import { enforceRateLimit } from "@/lib/rate-limit";
import { readFormValue } from "@/lib/form";
import { sanitizeRichHtml } from "@/lib/sanitize";
import { notifyUserById } from "@/lib/notifications";
import { validatePublicationNoticeInput } from "@/lib/publishing/integrity";

export type PublicationIntegrityResult = { success: boolean; message: string };

function fail(message: string): PublicationIntegrityResult {
  return { success: false, message };
}

/**
 * Creates an immutable public integrity notice. There is deliberately no
 * update/delete action: a later notice is the correction to an earlier notice,
 * which keeps the scholarly record auditable.
 */
export async function createPublicationNoticeAction(
  _previous: PublicationIntegrityResult,
  formData: FormData,
): Promise<PublicationIntegrityResult> {
  const auth = await getActiveUser("Log in to record a publication notice.");
  if (auth.frozen) return fail(auth.message);

  const limit = await enforceRateLimit({
    namespace: "publication-integrity:notice",
    key: auth.user.id,
    limit: 10,
    window: "1 h",
  });
  if (!limit.allowed) return { success: false, message: limit.error };

  const manuscriptId = readFormValue(formData, "manuscriptId");
  const type = readFormValue(formData, "type");
  const title = readFormValue(formData, "title").trim();
  const body = sanitizeRichHtml(readFormValue(formData, "body"));
  const inputProblem = validatePublicationNoticeInput({ type, title, body });
  if (inputProblem) return fail(inputProblem);

  const manuscript = await prisma.manuscript.findUnique({
    where: { id: manuscriptId },
    select: { id: true, title: true, status: true, authorId: true, venueId: true, venue: { select: { slug: true, type: true } } },
  });
  if (!manuscript) return fail("That manuscript no longer exists.");
  if (manuscript.status !== "PUBLISHED") return fail("Publication notices can only be added to published work.");

  const [isAdmin, role] = await Promise.all([
    isUserAdmin(auth.user.id),
    prisma.editorialRole.findFirst({ where: { userId: auth.user.id, venueId: manuscript.venueId, roleTitle: "EDITOR_IN_CHIEF" }, select: { id: true } }),
  ]);
  if (!isAdmin && !role) return fail("Only the venue Editor-in-Chief can record a publication notice.");

  await prisma.$transaction(async (tx) => {
    await tx.publicationNotice.create({
      data: {
        manuscriptId: manuscript.id,
        type: type as PublicationNoticeType,
        title,
        body,
        createdById: auth.user.id,
      },
    });

    await tx.manuscriptEvent.create({
      data: {
        manuscriptId: manuscript.id,
        type: "PUBLICATION_NOTICE_ADDED",
        actorId: auth.user.id,
        note: `${type.replaceAll("_", " ")} notice added: ${title}`,
      },
    });
  });

  await notifyUserById({
    recipientId: manuscript.authorId,
    actorId: auth.user.id,
    type: "manuscript-published",
    targetType: "manuscript",
    targetId: manuscript.id,
    title: `Publication notice for ${manuscript.title}`,
    body: `A ${type.toLowerCase().replace(/_/g, " ")} notice was added to your published work.`,
  });

  const prefix = manuscript.venue.type === "JOURNAL" ? "sbj" : "sbc";
  revalidatePath(`/workspace/editorial/manuscripts/${manuscript.id}`);
  revalidatePath(`/${prefix}/${manuscript.venue.slug}/article/${manuscript.id}`);
  revalidatePath(`/${prefix}/${manuscript.venue.slug}`);
  revalidatePath(`/${prefix}/${manuscript.venue.slug}/archive`);
  return { success: true, message: "The immutable publication notice was recorded." };
}
