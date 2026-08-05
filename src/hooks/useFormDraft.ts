"use client";

import { useState, useEffect, useCallback } from "react";

type DraftFields = Record<string, any>;

/**
 * Custom hook to persist form field values to localStorage.
 * Allows users to leave and come back without losing their typed content.
 *
 * @param draftKey - Unique key for localStorage, or null to disable drafting.
 * @param initialValues - Default field values
 * @returns [fields, updateField, resetDraft, isRestored]
 */
export function useFormDraft(
    draftKey: string | null,
    initialValues: DraftFields = {}
): [
        DraftFields,
        (field: string, value: any) => void,
        () => void,
        boolean,
    ] {
    const [fields, setFields] = useState<DraftFields>(initialValues);
    const [isRestored, setIsRestored] = useState(false);

    // We stringify initialValues to use it as a dependency, preventing
    // an infinite loop if the parent component creates a new object on every render.
    const initialValuesString = JSON.stringify(initialValues);

    useEffect(() => {
        const newInitialValues = JSON.parse(initialValuesString);

        if (!draftKey) {
            setFields(newInitialValues);
            setIsRestored(true);
            return;
        }

        try {
            const saved = localStorage.getItem(draftKey);
            if (saved) {
                const parsed = JSON.parse(saved) as DraftFields;
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
        (updatedFields: DraftFields) => {
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
        (field: string, value: any) => {
            setFields((prev) => {
                const updated = { ...prev, [field]: value };
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
        };
        try {
            localStorage.removeItem(draftKey);
        } catch {
            // Ignore
        }
        setFields(initialValues);
    }, [draftKey, initialValues]);

    return [fields, updateField, resetDraft, isRestored];
}
