"use client";

import { useState, useEffect, useCallback } from "react";

type DraftFields = Record<string, string>;

/**
 * Custom hook to persist form field values to localStorage.
 * Allows users to leave and come back without losing their typed content.
 *
 * @param draftKey - Unique key for localStorage (e.g., "draft_vacancy")
 * @param initialValues - Default field values
 * @returns [fields, updateField, resetDraft, isRestored]
 */
export function useFormDraft(
    draftKey: string,
    initialValues: DraftFields = {}
): [
        DraftFields,
        (field: string, value: string) => void,
        () => void,
        boolean,
    ] {
    const [fields, setFields] = useState<DraftFields>(initialValues);
    const [isRestored, setIsRestored] = useState(false);

    // On mount, check localStorage for saved draft
    useEffect(() => {
        try {
            const saved = localStorage.getItem(draftKey);
            if (saved) {
                const parsed = JSON.parse(saved) as DraftFields;
                // Merge saved draft with initialValues, giving priority to saved draft
                setFields((prev) => ({ ...prev, ...parsed }));
                setIsRestored(true);
            }
        } catch {
            // Ignore parse errors
        }
    }, [draftKey]);

    // Save to localStorage whenever fields change (debounced via the updateField)
    const saveDraft = useCallback(
        (updatedFields: DraftFields) => {
            try {
                localStorage.setItem(draftKey, JSON.stringify(updatedFields));
            } catch {
                // localStorage might be full or unavailable
            }
        },
        [draftKey]
    );

    const updateField = useCallback(
        (field: string, value: string) => {
            setFields((prev) => {
                const updated = { ...prev, [field]: value };
                saveDraft(updated);
                return updated;
            });
        },
        [saveDraft]
    );

    const resetDraft = useCallback(() => {
        try {
            localStorage.removeItem(draftKey);
        } catch {
            // Ignore
        }
        setFields(initialValues);
    }, [draftKey, initialValues]);

    return [fields, updateField, resetDraft, isRestored];
}

