import {
  createJobVacancy,
  updateJobVacancy,
} from "@/app/actions/opportunities";

export type VacancyFormValues = {
  title: string;
  institution: string;
  deadline: string; // yyyy-mm-dd
  description: string;
  notificationLink: string;
  applyLink: string;
};

// 👇 1. Removed "use client" so this runs flawlessly as a Server Component
export default function VacancyForm({
  mode,
  vacancyId,
  initialValues,
}: {
  mode: "create" | "edit";
  vacancyId?: string;
  initialValues?: Partial<VacancyFormValues>;
}) {
  const values: VacancyFormValues = {
    title: initialValues?.title ?? "",
    institution: initialValues?.institution ?? "",
    deadline: initialValues?.deadline ?? "",
    description: initialValues?.description ?? "",
    notificationLink: initialValues?.notificationLink ?? "",
    applyLink: initialValues?.applyLink ?? "",
  };

  // 👇 2. Define the Server Action cleanly OUTSIDE of the JSX
  async function handleEditAction(formData: FormData) {
    "use server";
    await updateJobVacancy(formData, String(vacancyId));
  }

  // 👇 3. Decide which action to use before the return statement
  const formAction = mode === "edit" ? handleEditAction : createJobVacancy;

  return (
    <form
      action={formAction}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      <div>
        <label className="sb-label">Job Title</label>
        <input
          name="title"
          placeholder="e.g., Assistant Professor (Contractual)"
          className="sb-input"
          required
          defaultValue={values.title}
        />
      </div>

      <div>
        <label className="sb-label">Institution / College</label>
        <input
          name="institution"
          placeholder="e.g., Delhi University"
          className="sb-input"
          required
          defaultValue={values.institution}
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
        <label className="sb-label">Details (Pay Scale, Qualifications)</label>
        <textarea
          name="description"
          placeholder="Detail the eligibility metrics (e.g., UGC regulations compliance, API score requirements)..."
          className="sb-input h-32"
          required
          defaultValue={values.description}
        />
      </div>

      <div>
        <label className="sb-label">Official Advertisement link</label>
        <input
          type="url"
          name="notificationLink"
          placeholder="https://institution.org/jobs/advt-2026.pdf"
          className="sb-input"
          required
          defaultValue={values.notificationLink}
        />
      </div>

      <div>
        <label className="sb-label">Application Link / Email</label>
        <input
          type="url"
          name="applyLink"
          placeholder="https://recruitment.portal or mailto:hr@inst.edu"
          className="sb-input"
          required
          defaultValue={values.applyLink}
        />
      </div>

      <button type="submit" className="sb-button-accent mt-2 self-end">
        {mode === "edit" ? "Save Changes" : "Post Vacancy"}
      </button>
    </form>
  );
}