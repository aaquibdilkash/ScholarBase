/**
 * Shared comment types used across CommentSection and related components.
 */
import type { VoteType } from "./votes";

/** Minimal author shape for comments. */
export interface CommentUser {
    id: string;
    name: string | null;
    handle?: string | null;
    avatarUrl: string | null;
}

/** A single comment (top-level or reply). */
export interface CommentItem {
    id: string;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    author: CommentUser | null;
    totalVotes: number;
    userVote: VoteType | null;
    totalReplies: number;
    parentId: string | null;
    mentions?: { id: string, handle: string | null }[] | null;
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
