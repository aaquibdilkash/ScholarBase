"use client";

import { createJobVacancy, updateJobVacancy } from "@/app/actions/vacancies";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";

export type VacancyFormValues = {
  title: string;
  institution: string;
  deadline: string;
  description: string;
  notificationLink: string;
  applyLink: string;
};

export default function VacancyForm({
  mode,
  vacancyId,
  initialValues,
}: {
  mode: "create" | "edit";
  vacancyId?: string;
  initialValues?: Partial<VacancyFormValues>;
}) {
  const initial = {
    title: initialValues?.title ?? "",
    institution: initialValues?.institution ?? "",
    deadline: initialValues?.deadline ?? "",
    description: initialValues?.description ?? "",
    notificationLink: initialValues?.notificationLink ?? "",
    applyLink: initialValues?.applyLink ?? "",
  };

  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    `draft_vacancy_${mode}`,
    initial,
  );

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage: "Vacancy posted successfully!",
      errorMessage: "Failed to post vacancy.",
    },
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (mode === "edit" && vacancyId) {
      // Edit mode: redirects server-side
      await updateJobVacancy(formData, vacancyId);
    } else {
      await submit(() => createJobVacancy(formData));
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      <div>
        <label className="sb-label">Job Title</label>
        <input
          name="title"
          placeholder="e.g., Assistant Professor (Contractual)"
          className="sb-input"
          required
          value={draftFields.title}
          onChange={(e) => updateDraftField("title", e.target.value)}
        />
      </div>

      <div>
        <label className="sb-label">Institution / College</label>
        <input
          name="institution"
          placeholder="e.g., Delhi University"
          className="sb-input"
          required
          value={draftFields.institution}
          onChange={(e) => updateDraftField("institution", e.target.value)}
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
        <label className="sb-label">Details (Pay Scale, Qualifications)</label>
        <textarea
          name="description"
          placeholder="Detail the eligibility metrics (e.g., UGC regulations compliance, API score requirements)..."
          className="sb-input h-32"
          required
          value={draftFields.description}
          onChange={(e) => updateDraftField("description", e.target.value)}
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
          value={draftFields.notificationLink}
          onChange={(e) => updateDraftField("notificationLink", e.target.value)}
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
          value={draftFields.applyLink}
          onChange={(e) => updateDraftField("applyLink", e.target.value)}
        />
      </div>

      <SubmitBtn className="sb-button-accent mt-2 self-end">
        {mode === "edit" ? "Save Changes" : "Post Vacancy"}
      </SubmitBtn>
    </form>
  );
}
