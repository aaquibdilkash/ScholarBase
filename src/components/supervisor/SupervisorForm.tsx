import { createSupervisor, updateSupervisor } from "@/app/actions/supervisors";
import { SubmitBtn } from "@/components/ui/SubmitBtn";

export type SupervisorFormValues = {
  name: string;
  university: string;
  department?: string;
  about?: string;
};

// 👇 1. Removed "use client" so this runs as a Server Component
export default function SupervisorForm({
  mode,
  supervisorId,
  initialValues,
}: {
  mode: "create" | "edit";
  supervisorId?: string;
  initialValues?: Partial<SupervisorFormValues>;
}) {
  const values: SupervisorFormValues = {
    name: initialValues?.name ?? "",
    university: initialValues?.university ?? "",
    department: initialValues?.department ?? "",
    about: initialValues?.about ?? "",
  };

  // 👇 2. Define the Server Action cleanly OUTSIDE of the JSX
  async function handleEditAction(formData: FormData) {
    "use server";
    await updateSupervisor(formData, String(supervisorId));
  }

  // 👇 3. Decide which action to use before the return statement
  const formAction = mode === "edit" ? handleEditAction : createSupervisor;

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <label className="sb-label">Full Name</label>
        <input
          name="name"
          placeholder="e.g., Prof. John Smith"
          className="sb-input"
          required
          defaultValue={values.name}
        />
      </div>

      <div>
        <label className="sb-label">University / Institution</label>
        <input
          name="university"
          placeholder="e.g., Jamia Millia Islamia"
          className="sb-input"
          required
          defaultValue={values.university}
        />
      </div>

      <div>
        <label className="sb-label">Department (Optional)</label>
        <input
          name="department"
          placeholder="e.g., Management and Finance"
          className="sb-input"
          defaultValue={values.department}
        />
      </div>

      <div>
        <label className="sb-label">About (Optional)</label>
        <textarea
          name="about"
          placeholder="A short bio / research interests"
          className="sb-input min-h-[120px] resize-y"
          defaultValue={values.about}
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
