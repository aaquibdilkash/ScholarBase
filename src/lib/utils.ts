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

/**
 * Production React masks every uncaught Server Action / RSC error as
 * "Minified React error #441; visit https://react.dev/errors/441 ..." so the
 * browser never sees the real reason (it only exists in the server log next to
 * the error digest). Showing that string in a toast is worse than useless, so
 * map it to the caller's fallback. Real action messages pass through.
 */
export function friendlyActionError(err: unknown, fallback: string): string {
    const message = err instanceof Error ? err.message.trim() : "";
    if (!message) return fallback;
    if (/^Minified React error #\d+/.test(message)) return fallback;
    if (message.includes("An error occurred in the Server Components render")) return fallback;
    return message;
}

