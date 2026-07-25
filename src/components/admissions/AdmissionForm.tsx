"use client";

import {
  updatePhdAdmission,
  createPhdAdmission,
} from "@/app/actions/admissions";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";

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

  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    `draft_admission_${mode}`,
    initial,
  );

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage: "Admission posted successfully!",
      errorMessage: "Failed to post admission.",
    },
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (mode === "edit" && admissionId) {
      await updatePhdAdmission(formData, admissionId);
    } else {
      await submit(() => createPhdAdmission(formData));
    }
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
        <textarea
          name="description"
          placeholder="Specify JRF/NET exemptions, tentative seats, or specialization availability..."
          className="sb-input h-32"
          required
          value={draftFields.description}
          onChange={(e) => updateDraftField("description", e.target.value)}
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

      <SubmitBtn className="sb-button-accent mt-2 self-end">
        {mode === "edit" ? "Save Changes" : "Post Notification"}
      </SubmitBtn>
    </form>
  );
}
