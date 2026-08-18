"use client";

import {
  createResearchTool,
  updateResearchTool,
} from "@/app/actions/researchTools";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useQueryClient } from "@tanstack/react-query";
import { upsertToList } from "@/utils/cacheMutation";
import type { ResearchToolWithAuthor } from "@/types/cards";

export type ResearchToolFormValues = {
  name: string;
  website: string;
  use: string;
  description: string;
};

export default function ResearchToolForm({
  mode,
  toolId,
  initialValues,
}: {
  mode: "create" | "edit";
  toolId?: string;
  initialValues?: Partial<ResearchToolFormValues>;
}) {
  const initial = {
    name: initialValues?.name ?? "",
    website: initialValues?.website ?? "",
    use: initialValues?.use ?? "",
    description: initialValues?.description ?? "",
  };

  const draftKey = mode === "edit" ? null : "draft_researchtool_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial
  );
  const queryClient = useQueryClient();

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage: "Research tool added successfully!",
      errorMessage: "Failed to add research tool.",
      onSuccess: (response) => {
        if (response.success && response.data) {
          upsertToList<ResearchToolWithAuthor>(
            queryClient,
            ["researchTools"],
            response.data as ResearchToolWithAuthor,
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
      if (mode === "edit" && toolId) {
        return updateResearchTool(formData, toolId);
      } else {
        return createResearchTool(formData);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      <div>
        <label className="sb-label">Tool Name</label>
        <input
          name="name"
          placeholder="e.g., Zotero"
          className="sb-input"
          required
          value={draftFields.name}
          onChange={(e) => updateDraftField("name", e.target.value)}
        />
      </div>

      <div>
        <label className="sb-label">Website</label>
        <input
          name="website"
          placeholder="e.g., https://www.zotero.org/"
          className="sb-input"
          required
          value={draftFields.website}
          onChange={(e) => updateDraftField("website", e.target.value)}
        />
      </div>

      <div>
        <label className="sb-label">Primary Use</label>
        <input
          name="use"
          placeholder="e.g., Reference Management"
          className="sb-input"
          required
          value={draftFields.use}
          onChange={(e) => updateDraftField("use", e.target.value)}
        />
      </div>

      <div>
        <label className="sb-label">Description</label>
        <Editor
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
        {mode === "create" && <FormCancelButton href="/research-tools" />}
        <SubmitBtnWithAuth className="sb-button-accent" disabled={submitting}>
          {mode === "edit" ? "Save Changes" : "Add Research Tool"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
