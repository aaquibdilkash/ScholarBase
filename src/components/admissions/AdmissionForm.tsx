"use client";

import {
  updatePhdAdmission,
  createPhdAdmission,
} from "@/app/actions/admissions";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useQueryClient } from "@tanstack/react-query";
import { upsertToList } from "@/utils/cacheMutation";
import { useRouter } from "next/navigation";
import { CautionNote } from "@/components/ui/CautionNote";
import {
  MAX_ADMISSION_UNIVERSITY,
  MAX_ADMISSION_DEPARTMENT,
  MAX_ADMISSION_DESCRIPTION,
  MAX_ADMISSION_NOTIFICATION_LINK,
  MAX_ADMISSION_APPLY_LINK,
} from "@/lib/constants";
import type { AdmissionWithAuthor } from "@/types/cards";

export type AdmissionFormValues = {
  university: string;
  department: string;
  deadline: string;
  description: string;
  notificationLink: string;
  applyLink: string;
};

export default function AdmissionForm({
  mode,
  admissionId,
  initialValues,
}: {
  mode: "create" | "edit";
  admissionId?: string;
  initialValues?: Partial<AdmissionFormValues>;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const initial = {
    university: initialValues?.university ?? "",
    department: initialValues?.department ?? "",
    deadline: initialValues?.deadline ?? "",
    description: initialValues?.description ?? "",
    notificationLink: initialValues?.notificationLink ?? "",
    applyLink: initialValues?.applyLink ?? "",
  };

  const draftKey = mode === "edit" ? null : "draft_admission_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial,
  );

  const { submit } = useFormSubmit(mode !== "edit" ? resetDraft : undefined, {
    resetOnSuccess: mode !== "edit",
    successMessage:
      mode === "edit"
        ? "Admission updated successfully!"
        : "Admission posted successfully!",
    errorMessage:
      mode === "edit"
        ? "Failed to update admission."
        : "Failed to post admission.",
    onSuccess: (response) => {
      if (!response.success) return;
      const data = response.data as AdmissionWithAuthor;
      upsertToList<AdmissionWithAuthor>(
        queryClient,
        ["admissions", ""],
        data,
        mode,
      );
      router.push(`/admissions/${data.id}`);
    }
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    await submit(() => {
      if (mode === "edit" && admissionId) {
        return updatePhdAdmission(formData, admissionId);
      } else {
        return createPhdAdmission(formData);
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
        <label className="sb-label">University / Institute</label>
        <input
          name="university"
          placeholder="e.g., Jamia Millia Islamia"
          className="sb-input"
          required
          maxLength={MAX_ADMISSION_UNIVERSITY}
          value={draftFields.university}
          onChange={(e) => updateDraftField("university", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.university.length}/{MAX_ADMISSION_UNIVERSITY} characters
        </div>
      </div>

      <div>
        <label className="sb-label">Department / Faculty</label>
        <input
          name="department"
          placeholder="e.g., Department of Management Studies"
          className="sb-input"
          required
          maxLength={MAX_ADMISSION_DEPARTMENT}
          value={draftFields.department}
          onChange={(e) => updateDraftField("department", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.department.length}/{MAX_ADMISSION_DEPARTMENT} characters
        </div>
      </div>

      <div>
        <label className="sb-label">Last Date to Apply</label>
        <input
          type="date"
          name="deadline"
          className="sb-input"
          required
          value={draftFields.deadline}
          onChange={(e) => updateDraftField("deadline", e.target.value)}
        />
      </div>

      <div>
        <label className="sb-label">Seat Matrix / Eligibility Notes</label>
        <Editor
          value={draftFields.description}
          onChange={(data) => updateDraftField("description", data)}
          maxLength={MAX_ADMISSION_DESCRIPTION}
        />
        <input
          type="hidden"
          name="description"
          value={draftFields.description}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {String(draftFields.description.length).replace(/(\d+)(?=.(\d{3})*$)/g, "$1,")}/{MAX_ADMISSION_DESCRIPTION} characters
        </div>
      </div>

      <div>
        <label className="sb-label">Notification Circular URL</label>
        <input
          type="url"
          name="notificationLink"
          placeholder="https://university.edu/admission-notice.pdf"
          className="sb-input"
          required
          maxLength={MAX_ADMISSION_NOTIFICATION_LINK}
          value={draftFields.notificationLink}
          onChange={(e) => updateDraftField("notificationLink", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.notificationLink.length}/{MAX_ADMISSION_NOTIFICATION_LINK} characters
        </div>
      </div>

      <div>
        <label className="sb-label">Application Portal URL</label>
        <input
          type="url"
          name="applyLink"
          placeholder="https://jmicoe.in"
          className="sb-input"
          required
          maxLength={MAX_ADMISSION_APPLY_LINK}
          value={draftFields.applyLink}
          onChange={(e) => updateDraftField("applyLink", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.applyLink.length}/{MAX_ADMISSION_APPLY_LINK} characters
        </div>
      </div>

      <div className="mt-2 flex justify-end gap-3">
        <FormCancelButton />
        <SubmitBtnWithAuth className="sb-button-accent">
          {mode === "edit" ? "Save Changes" : "Post Notification"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
