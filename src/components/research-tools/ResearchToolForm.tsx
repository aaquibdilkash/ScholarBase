"use client";

import {
  createResearchTool,
  updateResearchTool,
} from "@/app/actions/researchTools";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";

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

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage: "Research tool added successfully!",
      errorMessage: "Failed to add research tool.",
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

      <SubmitBtnWithAuth className="sb-button-accent mt-2 self-end">
        {mode === "edit" ? "Save Changes" : "Add Research Tool"}
      </SubmitBtnWithAuth>
    </form>
  );
}
