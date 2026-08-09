/**
 * Shared form-related types used across form components and hooks.
 */

/** Arbitrary draft field values persisted to localStorage. */
export type FormDraftFields = Record<string, unknown>;

/** Update function signature returned by useFormDraft. */
export type UpdateFieldFn = (field: string, value: unknown) => void;

/** Reset function signature returned by useFormDraft. */
export type ResetDraftFn = () => void;

/** Result shape returned by server actions invoked through useFormSubmit. */
export interface SubmitResult {
    success: boolean;
    redirect?: string;
    error?: string;
}

/** Options accepted by useFormSubmit. */
export interface SubmitOptions {
    /** If true, resets the draft on success (true for create, false for edit). */
    resetOnSuccess?: boolean;
    /** Custom success message. */
    successMessage?: string;
    /** Custom error message prefix. */
    errorMessage?: string;
}
