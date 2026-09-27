"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ui/Toast";
import { invalidateProfileTabs } from "@/utils/cacheMutation";
import type {
    SubmitOptions,
    SubmitResult,
    ResetDraftFn,
} from "@/types/form";

/**
 * Reusable hook to standardize form submission with draft management.
 * Calls resetDraft() ONLY after successful server response.
 * Handles loading states, error handling, and client-side redirect.
 *
 * Returns { submitting, submit } where `submit` takes an async action function.
 * This avoids name collisions with form `onSubmit` handlers.
 */
export function useFormSubmit(
    resetDraft?: ResetDraftFn,
    options: SubmitOptions = {},
) {
    const [submitting, setSubmitting] = useState(false);
    const router = useRouter();
    const { toast } = useToast();
    const queryClient = useQueryClient();

    const {
        resetOnSuccess = true,
        successMessage = "Created successfully!",
        errorMessage = "Something went wrong",
        onSuccess,
    } = options;

    const submit = useCallback(
        async (action: () => Promise<void | SubmitResult>): Promise<boolean> => {
            setSubmitting(true);
            try {
                const result = await action();

                // If the action returned a success result, handle it
                if (result && typeof result === "object" && "success" in result) {
                    const r = result as SubmitResult;

                    if (r.success) {
                        // ✅ Success — now reset the draft
                        if (resetOnSuccess && resetDraft) {
                            resetDraft();
                        }

                        // Every content form funnels through here, so this is the
                        // one place that has to tell the scholar's own Content
                        // and Activity tabs their cached rows just went stale.
                        // The server cache was purged by the same mutation, so
                        // marking is enough — no round trip while the tab is shut.
                        invalidateProfileTabs(queryClient, "content", "activity");

                        // Let the caller patch the React Query cache (client-side mutation)
                        if (onSuccess) {
                            onSuccess(r);
                        }

                        if (r.redirect) {
                            toast(r.success ? successMessage : r.error || errorMessage);
                            setTimeout(() => {
                                router.push(r.redirect!);
                            }, 300);
                        } else {
                            toast(successMessage);
                        }
                        return true;
                    } else {
                        // Server returned error
                        toast(r.error || errorMessage, "error");
                    }
                }
                // If no result (action did redirect or threw), the catch block handles it
            } catch (err: unknown) {
                // ❌ Error — draft is NOT reset, values preserved
                const message =
                    err instanceof Error ? err.message : errorMessage;
                toast(message, "error");
            } finally {
                setSubmitting(false);
            }
            return false;
        },
        [resetDraft, resetOnSuccess, router, toast, successMessage, errorMessage, onSuccess, queryClient],
    );

    return { submitting, submit };
}
