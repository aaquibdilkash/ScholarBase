"use client";

import { createJobVacancy, updateJobVacancy } from "@/app/actions/vacancies";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import type { VacancyWithAuthor } from "@/types/cards";

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

  const draftKey = mode === "edit" ? null : "draft_vacancy_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial,
  );

  const queryClient = useQueryClient();
  const router = useRouter();
  const searchParams = useSearchParams();
  const q = searchParams.get("q") ?? "";
  const { toast } = useToast();

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: createJobVacancy,
    onSuccess: (result) => {
      if (result.success && result.data) {
        toast("Vacancy posted successfully!", "success");
        queryClient.setQueryData(['vacancies', ''], (oldData: VacancyWithAuthor[] | undefined) => {
          return [result.data as VacancyWithAuthor, ...(oldData || [])];
        });
        resetDraft();
        router.push('/vacancies');
      } else {
        toast("Failed to post vacancy.", "error");
      }
    },
    onError: (error) => {
      toast(error.message, "error");
    },
  });

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: (data: { formData: FormData, vacancyId: string }) => updateJobVacancy(data.formData, data.vacancyId),
    onSuccess: (result) => {
      if (result?.success && result?.data) {
        const updatedVacancy = result.data as VacancyWithAuthor;
        toast("Vacancy updated successfully!", "success");

        // Update list cache
        queryClient.setQueryData(['vacancies', q], (oldData: VacancyWithAuthor[] | undefined) => 
          oldData?.map(v => v.id === updatedVacancy.id ? updatedVacancy : v)
        );

        // Update detail cache
        queryClient.setQueryData(['vacancy', updatedVacancy.id], updatedVacancy);
        
        router.push(`/vacancies/${updatedVacancy.id}`);
      } else {
        toast("Failed to update vacancy.", "error");
      }
    },
    onError: (error) => {
      toast(error.message, "error");
    },
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (mode === "edit" && vacancyId) {
      update({ formData, vacancyId });
    } else {
      create(formData);
    }
  }

  const isPending = isCreating || isUpdating;

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
          disabled={isPending}
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
          disabled={isPending}
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
          disabled={isPending}
        />
      </div>

      <div>
        <label className="sb-label">Details (Pay Scale, Qualifications)</label>
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
        <label className="sb-label">Official Advertisement link</label>
        <input
          type="url"
          name="notificationLink"
          placeholder="https://institution.org/jobs/advt-2026.pdf"
          className="sb-input"
          required
          value={draftFields.notificationLink}
          onChange={(e) => updateDraftField("notificationLink", e.target.value)}
          disabled={isPending}
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
          disabled={isPending}
        />
      </div>

      <div className="mt-2 flex justify-end gap-3">
        {mode === "create" && <FormCancelButton href="/vacancies" />}
        <SubmitBtnWithAuth
          className="sb-button-accent"
          disabled={isPending}
          loadingText={mode === "edit" ? "Saving..." : "Posting..."}
        >
          {mode === "edit" ? "Save Changes" : "Post Vacancy"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
