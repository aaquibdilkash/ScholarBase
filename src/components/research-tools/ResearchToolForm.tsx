"use client";

import { useRouter } from "next/navigation";
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
import { CautionNote } from "@/components/ui/CautionNote";
import {
  MAX_RESEARCH_TOOL_NAME,
  MAX_RESEARCH_TOOL_WEBSITE,
  MAX_RESEARCH_TOOL_DESCRIPTION,
  MAX_RESEARCH_TOOL_USE,
} from "@/lib/constants";
import type { ResearchToolWithAuthor } from "@/types/cards";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  RESEARCH_TOOL_NAME_TIP,
  RESEARCH_TOOL_WEBSITE_TIP,
  RESEARCH_TOOL_USE_TIP,
  RESEARCH_TOOL_DESCRIPTION_TIP,
} from "@/constants/tooltips";

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
  const router = useRouter();
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
      successMessage:
        mode === "create"
          ? "Research tool added successfully!"
          : "Research tool updated successfully!",
      errorMessage:
        mode === "create"
          ? "Failed to add research tool."
          : "Failed to update research tool.",
      onSuccess: (response) => {
        if (response.success && response.data) {
          const data = response.data as ResearchToolWithAuthor;
          upsertToList<ResearchToolWithAuthor>(
            queryClient,
            ["researchTools"],
            data,
            mode,
          );
          router.push(`/research-tools/${data.id}`);
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
      <CautionNote />
      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Tool Name
          <InfoTooltip message={RESEARCH_TOOL_NAME_TIP} />
        </label>
        <input
          name="name"
          placeholder="e.g., Zotero"
          className="sb-input"
          required
          maxLength={MAX_RESEARCH_TOOL_NAME}
          value={draftFields.name}
          onChange={(e) => updateDraftField("name", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.name.length}/{MAX_RESEARCH_TOOL_NAME} characters
        </div>
      </div>

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Website
          <InfoTooltip message={RESEARCH_TOOL_WEBSITE_TIP} />
        </label>
        <input
          name="website"
          placeholder="e.g., https://www.zotero.org/"
          className="sb-input"
          required
          maxLength={MAX_RESEARCH_TOOL_WEBSITE}
          value={draftFields.website}
          onChange={(e) => updateDraftField("website", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.website.length}/{MAX_RESEARCH_TOOL_WEBSITE} characters
        </div>
      </div>

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Primary Use
          <InfoTooltip message={RESEARCH_TOOL_USE_TIP} />
        </label>
        <input
          name="use"
          placeholder="e.g., Reference Management"
          className="sb-input"
          required
          maxLength={MAX_RESEARCH_TOOL_USE}
          value={draftFields.use}
          onChange={(e) => updateDraftField("use", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.use.length}/{MAX_RESEARCH_TOOL_USE} characters
        </div>
      </div>

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Description
          <InfoTooltip message={RESEARCH_TOOL_DESCRIPTION_TIP} />
        </label>
        <Editor
          value={draftFields.description}
          onChange={(data) => updateDraftField("description", data)}
          maxLength={MAX_RESEARCH_TOOL_DESCRIPTION}
        />
        <input
          type="hidden"
          name="description"
          value={draftFields.description}
        />
      </div>

      <div className="mt-2 flex justify-end gap-3">
        <FormCancelButton />
        <SubmitBtnWithAuth className="sb-button-accent" disabled={submitting}>
          {mode === "edit" ? "Save Changes" : "Add Research Tool"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
