/**
 * Minimal visibility for content a moderator removed.
 *
 * Soft-deleted content is invisible everywhere, with one exception: the author
 * must still be able to appeal an admin's decision. This helper resolves that
 * case for a detail page without ever exposing the body, comments, or any other
 * author-generated data.
 *
 * It returns a row only when all of the following hold:
 *   - the row is soft-deleted,
 *   - the deletion was performed by a moderator (`deletedByType === "ADMIN"`),
 *   - the viewer is signed in and is either the author or an admin.
 *
 * Author-deleted content, anonymous visitors, and every other viewer get
 * `null`, so the page 404s exactly like any other missing row.
 */
import prisma from "@/lib/db";
import { getCurrentUser, isUserAdmin } from "@/lib/auth";
import { MODEL_MAP } from "@/lib/moderation-config";

export type ModeratorDeletedContent = {
  id: string;
  authorId: string | null;
  hasActiveAppeal: boolean;
};

/** Unique lookup used by the detail route (id, or slug for articles). */
type ContentLookup = { id: string } | { slug: string };

type FindUniqueDelegate = {
  findUnique: (args: {
    where: Record<string, unknown>;
    select: Record<string, boolean>;
  }) => Promise<Record<string, unknown> | null>;
};

const MODERATION_SELECT = {
  id: true,
  authorId: true,
  isDeleted: true,
  deletedByType: true,
  hasActiveAppeal: true,
} as const;

export async function getModeratorDeletedContent(
  contentType: string,
  lookup: ContentLookup,
): Promise<ModeratorDeletedContent | null> {
  const entry = MODEL_MAP[contentType];
  // `SCHOLAR_PROFILE` is a user, not a content row, and has no authorId.
  if (!entry || contentType === "SCHOLAR_PROFILE") return null;

  const viewer = await getCurrentUser();
  if (!viewer) return null;

  const delegate = (prisma as unknown as Record<string, FindUniqueDelegate>)[
    entry.model
  ];
  if (!delegate) return null;

  const row = await delegate.findUnique({
    where: { ...lookup, isDeleted: true, deletedByType: "ADMIN" },
    select: MODERATION_SELECT,
  });
  if (!row) return null;

  const authorId = (row.authorId as string | null) ?? null;
  if (authorId !== viewer.id && !(await isUserAdmin(viewer.id))) return null;

  return {
    id: row.id as string,
    authorId,
    hasActiveAppeal: Boolean(row.hasActiveAppeal),
  };
}
