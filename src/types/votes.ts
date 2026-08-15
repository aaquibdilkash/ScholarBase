/**
 * Shared vote types used across the app (VoteButton, interactions, cards).
 */

export type VoteType = "UPVOTE" | "DOWNVOTE";

export type VoteTargetType =
    | "article"
    | "post"
    | "vacancy"
    | "admission"
    | "event"
    | "supervisor"
    | "recommendation"
    | "help"
    | "journal"
    | "researchTool"
    | "researchGrant"
    | "course"
    | "result"
    | "contribution"
    | "publication"
    | "survey";

export interface VoteCounts {
    upvotes: number;
    downvotes: number;
}

export interface VoteResult {
    userVote: VoteType | null;
    upvotes: number;
    downvotes: number;
}

export interface AuthErrorResult {
    error: string;
}
