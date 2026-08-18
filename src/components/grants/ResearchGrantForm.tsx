"use client";

import { createResearchGrant, updateResearchGrant } from "@/app/actions/grants";
import { useQueryClient } from "@tanstack/react-query";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { upsertToList } from "@/utils/cacheMutation";
import type { ResearchGrantWithAuthor } from "@/types/cards";

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
  const initial = {
    title: initialValues?.title ?? "",
    amount: initialValues?.amount ?? "",
    description: initialValues?.description ?? "",
    applyLink: initialValues?.applyLink ?? "",
    infoLink: initialValues?.infoLink ?? "",
  };

  const draftKey = mode === "edit" ? null : "draft_research_grant_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(draftKey, initial);
  const queryClient = useQueryClient();

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage: "Research grant added successfully!",
      errorMessage: "Failed to save research grant.",
      onSuccess: (response) => {
        if (response.success && response.data) {
          upsertToList<ResearchGrantWithAuthor>(
            queryClient,
            ["grants"],
            response.data as ResearchGrantWithAuthor,
            mode,
          );
        }
      },
    },
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    await submit(() => {
      if (mode === "edit" && grantId) {
        return updateResearchGrant(formData, grantId);
      }
      return createResearchGrant(formData);
    });
  }

  return (
    <form onSubmit={onSubmit} className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10">
      <div>
        <label className="sb-label">Grant Title</label>
        <input name="title" placeholder="e.g., Early Career Research Grant 2026" className="sb-input" required value={draftFields.title} onChange={(e) => updateDraftField("title", e.target.value)} />
      </div>

      <div>
        <label className="sb-label">Amount</label>
        <input name="amount" placeholder="e.g., USD 25,000 or Fully funded" className="sb-input" value={draftFields.amount} onChange={(e) => updateDraftField("amount", e.target.value)} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="sb-label">Apply Link</label>
          <input name="applyLink" type="url" placeholder="https://..." className="sb-input" value={draftFields.applyLink} onChange={(e) => updateDraftField("applyLink", e.target.value)} />
        </div>
        <div>
          <label className="sb-label">Info Link</label>
          <input name="infoLink" type="url" placeholder="https://..." className="sb-input" value={draftFields.infoLink} onChange={(e) => updateDraftField("infoLink", e.target.value)} />
        </div>
      </div>

      <div>
        <label className="sb-label">How to Apply</label>
        <Editor value={draftFields.description} onChange={(data) => updateDraftField("description", data)} />
        <input type="hidden" name="description" value={draftFields.description} />
      </div>

      <div className="mt-2 flex justify-end gap-3">
        {mode === "create" && <FormCancelButton href="/grants" />}
        <SubmitBtnWithAuth className="sb-button-accent" disabled={submitting}>
          {mode === "edit" ? "Save Changes" : "Add Research Grant"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
