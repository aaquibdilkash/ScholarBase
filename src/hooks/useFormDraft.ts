"use client";

import { useState, useEffect, useCallback } from "react";
import type { FormDraftFields, UpdateFieldFn } from "@/types/form";

/**
 * Custom hook to persist form field values to localStorage.
 * Allows users to leave and come back without losing their typed content.
 *
 * @param draftKey - Unique key for localStorage, or null to disable drafting.
 * @param initialValues - Default field values
 * @returns [fields, updateField, resetDraft, isRestored]
 */
export function useFormDraft<T extends FormDraftFields>(
    draftKey: string | null,
    initialValues: T
): [
        T,
        UpdateFieldFn,
        () => void,
        boolean,
    ] {
    const [fields, setFields] = useState<T>(initialValues);
    const [isRestored, setIsRestored] = useState(false);

    // We stringify initialValues to use it as a dependency, preventing
    // an infinite loop if the parent component creates a new object on every render.
    const initialValuesString = JSON.stringify(initialValues);

    useEffect(() => {
        const newInitialValues = JSON.parse(initialValuesString) as T;

        if (!draftKey) {
            setFields(newInitialValues);
            setIsRestored(true);
            return;
        }

        try {
            const saved = localStorage.getItem(draftKey);
            if (saved) {
                const parsed = JSON.parse(saved) as T;
                setFields({ ...newInitialValues, ...parsed });
            } else {
                setFields(newInitialValues);
            }
        } catch {
            setFields(newInitialValues);
        } finally {
            setIsRestored(true);
        }
    }, [draftKey, initialValuesString]);


    const saveDraft = useCallback(
        (updatedFields: T) => {
            if (!draftKey) return;
            try {
                localStorage.setItem(draftKey, JSON.stringify(updatedFields));
            } catch {
                // localStorage might be full or unavailable
            }
        },
        [draftKey]
    );

    const updateField = useCallback(
        (field: string, value: unknown) => {
            setFields((prev) => {
                const updated = { ...prev, [field]: value } as T;
                if (draftKey) {
                    saveDraft(updated);
                }
                return updated;
            });
        },
        [draftKey, saveDraft]
    );

    const resetDraft = useCallback(() => {
        if (!draftKey) {
            setFields(initialValues);
            return;
        }
        try {
            localStorage.removeItem(draftKey);
        } catch {
            // Ignore
        }
        setFields(initialValues);
    }, [draftKey, initialValues]);

    return [fields, updateField, resetDraft, isRestored];
}
