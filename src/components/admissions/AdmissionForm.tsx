"use client";

import {
  updatePhdAdmission,
  createAdmissionSafe,
} from "@/app/actions/admissions";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";

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
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    await submit(() => {
      if (mode === "edit" && admissionId) {
        return updatePhdAdmission(formData, admissionId);
      } else {
        return createAdmissionSafe(formData);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      <div>
        <label className="sb-label">University / Institute</label>
        <input
          name="university"
          placeholder="e.g., Jamia Millia Islamia"
          className="sb-input"
          required
          value={draftFields.university}
          onChange={(e) => updateDraftField("university", e.target.value)}
        />
      </div>

      <div>
        <label className="sb-label">Department / Faculty</label>
        <input
          name="department"
          placeholder="e.g., Department of Management Studies"
          className="sb-input"
          required
          value={draftFields.department}
          onChange={(e) => updateDraftField("department", e.target.value)}
        />
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
        />
        <input
          type="hidden"
          name="description"
          value={draftFields.description}
        />
      </div>

      <div>
        <label className="sb-label">Notification Circular URL</label>
        <input
          type="url"
          name="notificationLink"
          placeholder="https://university.edu/admission-notice.pdf"
          className="sb-input"
          required
          value={draftFields.notificationLink}
          onChange={(e) => updateDraftField("notificationLink", e.target.value)}
        />
      </div>

      <div>
        <label className="sb-label">Application Portal URL</label>
        <input
          type="url"
          name="applyLink"
          placeholder="https://jmicoe.in"
          className="sb-input"
          required
          value={draftFields.applyLink}
          onChange={(e) => updateDraftField("applyLink", e.target.value)}
        />
      </div>

      <SubmitBtnWithAuth className="sb-button-accent mt-2 self-end">
        {mode === "edit" ? "Save Changes" : "Post Notification"}
      </SubmitBtnWithAuth>
    </form>
  );
}
