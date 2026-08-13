"use client";

import { createSupervisor, updateSupervisor } from "@/app/actions/supervisors";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";

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

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage: "Supervisor added successfully!",
      errorMessage: "Failed to add supervisor.",
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
      <div>
        <label className="sb-label">Full Name</label>
        <input
          name="name"
          placeholder="e.g., Prof. John Smith"
          className="sb-input"
          required
          value={draftFields.name}
          onChange={(e) => updateDraftField("name", e.target.value)}
        />
      </div>

      <div>
        <label className="sb-label">University / Institution</label>
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
        <label className="sb-label">Department (Optional)</label>
        <input
          name="department"
          placeholder="e.g., Management and Finance"
          className="sb-input"
          value={draftFields.department}
          onChange={(e) => updateDraftField("department", e.target.value)}
        />
      </div>

      <div>
        <label className="sb-label">About (Optional)</label>
        <Editor
          value={draftFields.about}
          onChange={(data) => updateDraftField("about", data)}
        />
        <input type="hidden" name="about" value={draftFields.about} />
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
        {mode === "create" && <FormCancelButton href="/supervisor" />}
        <SubmitBtnWithAuth className="sb-button-accent" disabled={submitting}>
          {mode === "edit" ? "Save Changes" : "Add Supervisor"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
