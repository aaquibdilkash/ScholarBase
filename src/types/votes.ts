/**
 * Shared vote types used across the app (VoteButton, votes, cards).
 */

export type VoteType = "UPVOTE" | "DOWNVOTE";

export type VoteTargetType =
    | "article"
    | "post"
    | "academicPosition"
    | "admission"
    | "callForPaper"
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

export interface AuthErrorResult {
    error: string;
}
