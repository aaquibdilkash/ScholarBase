import {
  updatePhdAdmission,
  createPhdAdmission,
} from "@/app/actions/admissions";
import { SubmitBtn } from "@/components/ui/SubmitBtn";

export type AdmissionFormValues = {
  university: string;
  department: string;
  deadline: string; // yyyy-mm-dd
  description: string;
  notificationLink: string;
  applyLink: string;
};

// 👇 1. Removed "use client" and removed "async" from the component definition
export default function AdmissionForm({
  mode,
  admissionId,
  initialValues,
}: {
  mode: "create" | "edit";
  admissionId?: string;
  initialValues?: Partial<AdmissionFormValues>;
}) {
  const values: AdmissionFormValues = {
    university: initialValues?.university ?? "",
    department: initialValues?.department ?? "",
    deadline: initialValues?.deadline ?? "",
    description: initialValues?.description ?? "",
    notificationLink: initialValues?.notificationLink ?? "",
    applyLink: initialValues?.applyLink ?? "",
  };

  // 👇 2. Define the Server Action cleanly OUTSIDE of the JSX
  async function handleEditAction(formData: FormData) {
    "use server";
    await updatePhdAdmission(formData, String(admissionId));
  }

  // 👇 3. Decide which action to use before the return statement
  const formAction = mode === "edit" ? handleEditAction : createPhdAdmission;

  return (
    <form
      action={formAction}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      <div>
        <label className="sb-label">University / Institute</label>
        <input
          name="university"
          placeholder="e.g., Jamia Millia Islamia"
          className="sb-input"
          required
          defaultValue={values.university}
        />
      </div>

      <div>
        <label className="sb-label">Department / Faculty</label>
        <input
          name="department"
          placeholder="e.g., Department of Management Studies"
          className="sb-input"
          required
          defaultValue={values.department}
        />
      </div>

      <div>
        <label className="sb-label">Last Date to Apply</label>
        <input
          type="date"
          name="deadline"
          className="sb-input"
          required
          defaultValue={values.deadline}
        />
      </div>

      <div>
        <label className="sb-label">Seat Matrix / Eligibility Notes</label>
        <textarea
          name="description"
          placeholder="Specify JRF/NET exemptions, tentative seats, or specialization availability..."
          className="sb-input h-32"
          required
          defaultValue={values.description}
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
          defaultValue={values.notificationLink}
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
          defaultValue={values.applyLink}
        />
      </div>

      <SubmitBtn className="sb-button-accent mt-2 self-end">
        {mode === "edit" ? "Save Changes" : "Post Notification"}
      </SubmitBtn>
    </form>
  );
}
