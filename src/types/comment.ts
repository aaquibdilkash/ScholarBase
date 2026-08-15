/**
 * Shared comment types used across CommentSection and related components.
 */

/** Minimal author shape for comments. */
export interface CommentUser {
    id: string;
    name: string | null;
    handle?: string | null;
    avatarUrl: string | null;
}

/** Vote shape on a comment. */
export interface CommentVote {
    userId: string;
    voteType: "UPVOTE" | "DOWNVOTE";
}

/** A single comment (top-level or reply). */
export interface CommentItem {
    id: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    author: CommentUser;
    votes: CommentVote[];
    parentId: string | null;
    mentions?: { id: string, handle: string | null }[] | null;
    _count: { votes: number };
}

/** A comment thread: top-level comment with nested replies. */
export interface CommentThread extends CommentItem {
    replies: CommentItem[];
}

/** The content target types a comment can be attached to. */
export type CommentTargetType =
    | "post"
    | "article"
    | "vacancy"
    | "admission"
    | "event"
    | "supervisor"
    | "recommendation"
    | "help"
    | "researchTool"
    | "researchGrant"
    | "course"
    | "journal"
    | "result"
    | "contribution"
    | "publication"
    | "survey";
