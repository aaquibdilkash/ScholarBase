import { DeletedByType } from "@prisma/client";
import { isUserAdmin } from "@/lib/auth";

// ============================================================================
// Permission resolution for soft deletes (deletedByType tracking).
//
// Hierarchy:
//   1. ADMIN                 — moderators can delete anything
//   2. AUTHOR                — the original author deletes their own content
//   3. POST_AUTHOR           — the root post author deletes any comment/reply
//                              on their post
//   4. PARENT_COMMENT_AUTHOR — the parent comment author deletes a child
//                              reply nested under their comment
// Everything else is unauthorized.
// ============================================================================

export async function resolvePostDeletePermission(
  userId: string,
  authorId: string | null,
): Promise<DeletedByType> {
  if (await isUserAdmin(userId)) return DeletedByType.ADMIN;
  if (authorId !== null && userId === authorId) return DeletedByType.AUTHOR;
  throw new Error("You do not have permission to delete this post.");
}

export async function resolveCommentDeletePermission(
  userId: string,
  opts: {
    commentAuthorId: string | null;
    rootPostAuthorId: string | null;
    parentCommentAuthorId: string | null;
    isReply: boolean;
  },
): Promise<DeletedByType> {
  if (await isUserAdmin(userId)) return DeletedByType.ADMIN;
  if (opts.commentAuthorId !== null && userId === opts.commentAuthorId) {
    return DeletedByType.AUTHOR;
  }
  if (opts.rootPostAuthorId !== null && userId === opts.rootPostAuthorId) {
    return DeletedByType.POST_AUTHOR;
  }
  if (opts.isReply && userId === opts.parentCommentAuthorId) {
    return DeletedByType.PARENT_COMMENT_AUTHOR;
  }
  throw new Error("You do not have permission to delete this comment.");
}
