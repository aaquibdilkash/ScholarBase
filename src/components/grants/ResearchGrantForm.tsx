"use client";

import { useRouter } from "next/navigation";
import { createResearchGrant, updateResearchGrant } from "@/app/actions/grants";
import { useQueryClient } from "@tanstack/react-query";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { upsertToList } from "@/utils/cacheMutation";
import { CautionNote } from "@/components/ui/CautionNote";
import type { ResearchGrantWithAuthor } from "@/types/cards";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  GRANT_TITLE_TIP,
  GRANT_AMOUNT_TIP,
  GRANT_APPLY_LINK_TIP,
  GRANT_INFO_LINK_TIP,
  GRANT_DESCRIPTION_TIP,
} from "@/constants/tooltips";

import {
  MAX_RESEARCH_GRANT_TITLE,
  MAX_RESEARCH_GRANT_AMOUNT,
  MAX_RESEARCH_GRANT_DESCRIPTION,
  MAX_RESEARCH_GRANT_APPLY_LINK,
  MAX_RESEARCH_GRANT_INFO_LINK,
} from "@/lib/constants";
import { getRichTextLength } from "@/lib/html";

export type ResearchGrantFormValues = {
  title: string;
  amount: string;
  description: string;
  applyLink: string;
  infoLink: string;
};

export default function ResearchGrantForm({
  mode,
  grantId,
  initialValues,
}: {
  mode: "create" | "edit";
  grantId?: string;
  initialValues?: Partial<ResearchGrantFormValues>;
}) {
  const router = useRouter();
  const initial = {
    title: initialValues?.title ?? "",
    amount: initialValues?.amount ?? "",
    description: initialValues?.description ?? "",
    applyLink: initialValues?.applyLink ?? "",
    infoLink: initialValues?.infoLink ?? "",
  };

  const draftKey = mode === "edit" ? null : "draft_research_grant_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial,
  );
  const queryClient = useQueryClient();

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage:
        mode === "create"
          ? "Research grant added successfully!"
          : "Research grant updated successfully!",
      errorMessage:
        mode === "create"
          ? "Failed to save research grant."
          : "Failed to update research grant.",
      onSuccess: (response) => {
        if (response.success && response.data) {
          const data = response.data as ResearchGrantWithAuthor;
          upsertToList<ResearchGrantWithAuthor>(
            queryClient,
            ["grants"],
            data,
            mode,
          );
          router.push(`/grants/${data.id}`);
        }
      },
    },
  );

  const isDescriptionOverLimit =
    getRichTextLength(draftFields.description) > MAX_RESEARCH_GRANT_DESCRIPTION;
  const isFormOverLimit = isDescriptionOverLimit;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isFormOverLimit) return;

    const formData = new FormData(e.currentTarget);

    await submit(() => {
      if (mode === "edit" && grantId) {
        return updateResearchGrant(formData, grantId);
      }
      return createResearchGrant(formData);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      <CautionNote />
      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Grant Title
          <InfoTooltip message={GRANT_TITLE_TIP} />
        </label>
          <input
            name="title"
            placeholder="e.g., Early Career Research Grant 2026"
            className="sb-input"
            required
            maxLength={MAX_RESEARCH_GRANT_TITLE}
            value={draftFields.title}
            onChange={(e) => updateDraftField("title", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.title.length}/{MAX_RESEARCH_GRANT_TITLE} characters
          </div>
        </div>

        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Amount
            <InfoTooltip message={GRANT_AMOUNT_TIP} />
          </label>
          <input
            name="amount"
            placeholder="e.g., USD 25,000 or Fully funded"
            className="sb-input"
            maxLength={MAX_RESEARCH_GRANT_AMOUNT}
            value={draftFields.amount}
            onChange={(e) => updateDraftField("amount", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.amount.length}/{MAX_RESEARCH_GRANT_AMOUNT} characters
          </div>
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="sb-label inline-flex items-center gap-1.5">
              Apply Link
              <InfoTooltip message={GRANT_APPLY_LINK_TIP} />
            </label>
            <input
              name="applyLink"
              type="url"
              placeholder="https://..."
              className="sb-input"
              maxLength={MAX_RESEARCH_GRANT_APPLY_LINK}
              value={draftFields.applyLink}
              onChange={(e) => updateDraftField("applyLink", e.target.value)}
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {draftFields.applyLink.length}/{MAX_RESEARCH_GRANT_APPLY_LINK} characters
            </div>
          </div>
          <div>
            <label className="sb-label inline-flex items-center gap-1.5">
              Info Link
              <InfoTooltip message={GRANT_INFO_LINK_TIP} />
            </label>
            <input
              name="infoLink"
              type="url"
              placeholder="https://..."
              className="sb-input"
              maxLength={MAX_RESEARCH_GRANT_INFO_LINK}
              value={draftFields.infoLink}
              onChange={(e) => updateDraftField("infoLink", e.target.value)}
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {draftFields.infoLink.length}/{MAX_RESEARCH_GRANT_INFO_LINK} characters
            </div>
          </div>
        </div>

        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            How to Apply
            <InfoTooltip message={GRANT_DESCRIPTION_TIP} />
          </label>
          <Editor
            maxLength={MAX_RESEARCH_GRANT_DESCRIPTION}
            value={draftFields.description}
            onChange={(data) => updateDraftField("description", data)}
          />
          <input
            type="hidden"
            name="description"
            value={draftFields.description}
          />
          
        </div>

      <div className="mt-2 flex justify-end gap-3">
        <FormCancelButton />
        <SubmitBtnWithAuth className="sb-button-accent" disabled={submitting || isFormOverLimit}>
          {mode === "edit" ? "Save Changes" : "Add Research Grant"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
