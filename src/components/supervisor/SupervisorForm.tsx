"use client";

import { createSupervisor, updateSupervisor } from "@/app/actions/supervisors";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";

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

  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    `draft_supervisor_${mode}`,
    initial,
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

    if (mode === "edit" && supervisorId) {
      await updateSupervisor(formData, supervisorId);
    } else {
      await submit(() => createSupervisor(formData));
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6">
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
        <textarea
          name="about"
          placeholder="A short bio / research interests"
          className="sb-input min-h-[120px] resize-y"
          value={draftFields.about}
          onChange={(e) => updateDraftField("about", e.target.value)}
        />
      </div>

      <div className="pt-4 border-t border-slate-100 flex justify-end">
        <SubmitBtn className="sb-button-accent">
          {mode === "edit" ? "Save Changes" : "Add Supervisor"}
        </SubmitBtn>
      </div>
    </form>
  );
}
