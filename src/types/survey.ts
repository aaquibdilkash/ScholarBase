/**
 * Shared survey types used across survey components and actions.
 */

export type SurveyPrivacy = "ANONYMOUS" | "NON_ANONYMOUS" | "HYBRID";

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
  options: QuestionOption[];
}

export interface SurveyAnswer {
  id: string;
  questionId: string;
  value: string;
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
  options?: SurveyOptionInput[];
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
  _count: {
    votes: number;
    comments: number;
    responses: number;
  };
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
  options: Array<{ id: string; value: string; label: string; order: number }>;
  answers: Array<{ value: string }>;
}

export interface SurveyResults {
  id: string;
  title: string;
  questions: QuestionResult[];
  _count: { responses: number };
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
    value: string;
  }>;
}
