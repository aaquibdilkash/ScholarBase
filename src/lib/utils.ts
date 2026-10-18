import { type ClassValue, clsx } from "clsx"
 
export function cn(...inputs: ClassValue[]) {
  return clsx(inputs)
}

/**
 * User-facing message from a failed server-action result.
 *
 * Frozen / deleted-account refusals come back as `{ success: false, error,
 * message }` (see `getActiveUser`), while validation failures (e.g. an invalid
 * URL) return only `{ success: false, message }` - so prefer `error`, then
 * `message`, then the caller's generic fallback. Every form that surfaces
 * server failures itself goes through here (useFormSubmit included) so a
 * frozen author always sees the real reason instead of a generic
 * "Failed to post ..." toast.
 */
export function actionErrorMessage(result: unknown, fallback: string): string {
    if (result && typeof result === "object") {
        const { error, message } = result as { error?: unknown; message?: unknown };
        if (typeof error === "string" && error) return error;
        if (typeof message === "string" && message) return message;
    }
    return fallback;
}

