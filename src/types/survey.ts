/**
 * Shared survey types used across survey components and actions.
 */

export type SurveyPrivacy = "ANONYMOUS" | "NON_ANONYMOUS" | "HYBRID";

/** Skip-logic rule stored on the trigger question (see lib/surveys/logic.ts). */
export interface SkipRule {
  operator: "equals" | "not_equals" | "includes";
  value: string;
  skipToOrder: number;
}

export interface SurveyBlock {
  id: string;
  title: string;
  order: number;
  randomizeOrder: boolean;
}

/** Form-facing block shape used by the builder (no persisted id until saved). */
export interface BlockInput {
  id?: string;
  title: string;
  order: number;
  randomizeOrder: boolean;
}

export interface SurveyOption {
  id: string;
  value: string;
  label: string;
  order: number;
  archivedAt?: Date | string | null;
}

export interface SurveyQuestion {
  id: string;
  type: string;
  title: string;
  required: boolean;
  order: number;
  minValue?: number | null;
  maxValue?: number | null;
  shuffleOptions?: boolean;
  skipLogic?: SkipRule[] | null;
  columnLabels?: string[] | null;
  blockId?: string | null;
  options: SurveyOption[];
}

/**
 * Form-facing option shape used by survey building components (QuestionEditor,
 * SurveyForm). These are lightweight and do not require a persisted `id` until
 * a survey is saved.
 */
export interface QuestionOption {
  id?: string;
  value: string;
  label: string;
  order: number;
}

/**
 * Form-facing question shape used by survey building components.
 */
export interface Question {
  id: string;
  type: string;
  title: string;
  required: boolean;
  order: number;
  minValue?: number | null;
  maxValue?: number | null;
  archivedAt?: Date | string | null;
  shuffleOptions?: boolean;
  skipLogic?: SkipRule[] | null;
  columnLabels?: string[] | null;
  blockId?: string | null;
  options: QuestionOption[];
  /** Stores type-specific data keyed by question type to preserve work when switching types */
  typeData?: Record<string, { options?: QuestionOption[]; minValue?: number | null; maxValue?: number | null; columnLabels?: string[] | null }>;
}

export interface SurveyAnswer {
  id: string;
  questionId: string;
  value: unknown;
}

/** Input shape for a survey option when creating/updating a survey. */
export interface SurveyOptionInput {
  id?: string;
  value: string;
  label: string;
  order: number;
}

/** Input shape for a survey question when creating/updating a survey. */
export interface SurveyQuestionInput {
  id?: string;
  type: string;
  title: string;
  required: boolean;
  order: number;
  minValue?: number;
  maxValue?: number;
  shuffleOptions?: boolean;
  skipLogic?: SkipRule[];
  columnLabels?: string[];
  blockId?: string | null;
  options?: SurveyOptionInput[];
}

/** Input shape for a survey block when creating/updating a survey. */
export interface SurveyBlockInput {
  id?: string;
  title: string;
  order: number;
  randomizeOrder: boolean;
}

export interface SurveyResponse {
  id: string;
  isAnonymous: boolean;
  answers: SurveyAnswer[];
}

/**
 * Extended survey shape with author and vote/comment/response counts.
 */
export interface SurveyWithDetails {
  id: string;
  title: string;
  description: string | null;
  privacy: string;
  shareData: boolean;
  author: {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
  };
  votes: {
    userId: string;
    voteType: 'UPVOTE' | 'DOWNVOTE';
  }[];
  totalVotes: number;
  totalComments: number;
  totalResponses: number;
  questions?: SurveyQuestion[];
}

export interface QuestionResult {
  id: string;
  title: string;
  type: string;
  order: number;
  minValue?: number | null;
  maxValue?: number | null;
  archivedAt?: string | null;
  columnLabels?: string[] | null;
  options: Array<{ id: string; value: string; label: string; order: number }>;
  answers: Array<{ value: unknown }>;
}

export interface SurveyResults {
  id: string;
  title: string;
  questions: QuestionResult[];
  totalResponses: number;
}

export interface IndividualResponse {
  id: string;
  createdAt: Date;
  isAnonymous: boolean;
  respondent: {
    id: string;
    name: string | null;
  } | null;
  answers: Array<{
    questionId: string;
    value: unknown;
  }>;
}
