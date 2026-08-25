"use client";

import { useRouter } from "next/navigation";
import { createSupervisor, updateSupervisor } from "@/app/actions/supervisors";
import { useQueryClient } from "@tanstack/react-query";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { upsertToList } from "@/utils/cacheMutation";
import { CautionNote } from "@/components/ui/CautionNote";
import type { SupervisorWithAuthor } from "@/types/cards";
import {
  MAX_SUPERVISOR_NAME,
  MAX_SUPERVISOR_UNIVERSITY,
  MAX_SUPERVISOR_DEPARTMENT,
  MAX_SUPERVISOR_ABOUT,
} from "@/lib/constants";

export type SupervisorFormValues = {
  name: string;
  university: string;
  department?: string;
  about?: string;
};

export default function SupervisorForm({
  mode,
  supervisorId,
  initialValues,
}: {
  mode: "create" | "edit";
  supervisorId?: string;
  initialValues?: Partial<SupervisorFormValues>;
}) {
  const router = useRouter();
  const initial = {
    name: initialValues?.name ?? "",
    university: initialValues?.university ?? "",
    department: initialValues?.department ?? "",
    about: initialValues?.about ?? "",
  };

  const draftKey = mode === "edit" ? null : "draft_supervisor_create";
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
          ? "Supervisor added successfully!"
          : "Supervisor updated successfully!",
      errorMessage:
        mode === "create"
          ? "Failed to add supervisor."
          : "Failed to update supervisor.",
      onSuccess: (response) => {
        if (response.success && response.data) {
          const data = response.data as SupervisorWithAuthor;
          upsertToList<SupervisorWithAuthor>(
            queryClient,
            ["supervisors"],
            data,
            mode,
          );
          router.push(`/supervisor/${data.id}`);
        }
      },
    },
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    await submit(() => {
      if (mode === "edit" && supervisorId) {
        return updateSupervisor(formData, supervisorId);
      } else {
        return createSupervisor(formData);
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
        <label className="sb-label">Full Name</label>
        <input
          name="name"
          placeholder="e.g., Prof. John Smith"
          className="sb-input"
          required
          maxLength={MAX_SUPERVISOR_NAME}
          value={draftFields.name}
          onChange={(e) => updateDraftField("name", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.name.length}/{MAX_SUPERVISOR_NAME} characters
        </div>
      </div>

      <div>
        <label className="sb-label">University / Institution</label>
        <input
          name="university"
          placeholder="e.g., Jamia Millia Islamia"
          className="sb-input"
          required
          maxLength={MAX_SUPERVISOR_UNIVERSITY}
          value={draftFields.university}
          onChange={(e) => updateDraftField("university", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.university.length}/{MAX_SUPERVISOR_UNIVERSITY} characters
        </div>
      </div>

      <div>
        <label className="sb-label">Department (Optional)</label>
        <input
          name="department"
          placeholder="e.g., Management and Finance"
          className="sb-input"
          maxLength={MAX_SUPERVISOR_DEPARTMENT}
          value={draftFields.department}
          onChange={(e) => updateDraftField("department", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.department.length}/{MAX_SUPERVISOR_DEPARTMENT} characters
        </div>
      </div>

      <div>
        <label className="sb-label">About (Optional)</label>
        <Editor
          maxLength={MAX_SUPERVISOR_ABOUT}
          value={draftFields.about}
          onChange={(data) => updateDraftField("about", data)}
        />
        <input type="hidden" name="about" value={draftFields.about} />
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
        <FormCancelButton />
        <SubmitBtnWithAuth className="sb-button-accent" disabled={submitting}>
          {mode === "edit" ? "Save Changes" : "Add Supervisor"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
