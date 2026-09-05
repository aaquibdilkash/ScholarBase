"use client";

import { createJobVacancy, updateJobVacancy } from "@/app/actions/vacancies";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { CautionNote } from "@/components/ui/CautionNote";
import {
  MAX_VACANCY_TITLE,
  MAX_VACANCY_INSTITUTION,
  MAX_VACANCY_NOTIFICATION_LINK,
  MAX_VACANCY_APPLY_LINK,
  MAX_VACANCY_DESCRIPTION,
} from "@/lib/constants";
import { getRichTextLength } from "@/lib/html";
import type { VacancyWithAuthor } from "@/types/cards";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  VACANCY_TITLE_TIP,
  VACANCY_INSTITUTION_TIP,
  VACANCY_DEADLINE_TIP,
  VACANCY_DESCRIPTION_TIP,
  VACANCY_NOTIFICATION_LINK_TIP,
  VACANCY_APPLY_LINK_TIP,
} from "@/constants/tooltips";

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

  const isDescriptionOverLimit =
    getRichTextLength(draftFields.description) > MAX_VACANCY_DESCRIPTION;
  const isFormOverLimit = isDescriptionOverLimit;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isFormOverLimit) return;

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
         <CautionNote />
      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Job Title
          <InfoTooltip message={VACANCY_TITLE_TIP} />
        </label>
        <input
          name="title"
          placeholder="e.g., Assistant Professor (Contractual)"
          className="sb-input"
          required
          maxLength={MAX_VACANCY_TITLE}
          value={draftFields.title}
          onChange={(e) => updateDraftField("title", e.target.value)}
          disabled={isPending}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.title.length}/{MAX_VACANCY_TITLE} characters
        </div>
      </div>

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Institution / College
          <InfoTooltip message={VACANCY_INSTITUTION_TIP} />
        </label>
        <input
          name="institution"
          placeholder="e.g., Delhi University"
          className="sb-input"
          required
          maxLength={MAX_VACANCY_INSTITUTION}
          value={draftFields.institution}
          onChange={(e) => updateDraftField("institution", e.target.value)}
          disabled={isPending}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.institution.length}/{MAX_VACANCY_INSTITUTION} characters
        </div>
      </div>

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Last Date to Apply
          <InfoTooltip message={VACANCY_DEADLINE_TIP} />
        </label>
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
        <label className="sb-label inline-flex items-center gap-1.5">
          Details (Pay Scale, Qualifications)
          <InfoTooltip message={VACANCY_DESCRIPTION_TIP} />
        </label>
        <Editor
          value={draftFields.description}
          onChange={(data) => updateDraftField("description", data)}
          maxLength={MAX_VACANCY_DESCRIPTION}
        />
        <input
          type="hidden"
          name="description"
          value={draftFields.description}
        />
      </div>

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Official Advertisement link
          <InfoTooltip message={VACANCY_NOTIFICATION_LINK_TIP} />
        </label>
        <input
          type="url"
          name="notificationLink"
          placeholder="https://institution.org/jobs/advt-2026.pdf"
          className="sb-input"
          required
          maxLength={MAX_VACANCY_NOTIFICATION_LINK}
          value={draftFields.notificationLink}
          onChange={(e) => updateDraftField("notificationLink", e.target.value)}
          disabled={isPending}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.notificationLink.length}/{MAX_VACANCY_NOTIFICATION_LINK} characters
        </div>
      </div>

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Application Link / Email
          <InfoTooltip message={VACANCY_APPLY_LINK_TIP} />
        </label>
        <input
          type="url"
          name="applyLink"
          placeholder="https://recruitment.portal or mailto:hr@inst.edu"
          className="sb-input"
          required
          maxLength={MAX_VACANCY_APPLY_LINK}
          value={draftFields.applyLink}
          onChange={(e) => updateDraftField("applyLink", e.target.value)}
          disabled={isPending}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.applyLink.length}/{MAX_VACANCY_APPLY_LINK} characters
        </div>
      </div>

      <div className="mt-2 flex justify-end gap-3">
        <FormCancelButton />
        <SubmitBtnWithAuth
          className="sb-button-accent"
          disabled={isPending || isFormOverLimit}
          loadingText={mode === "edit" ? "Saving..." : "Posting..."}
        >
          {mode === "edit" ? "Save Changes" : "Post Vacancy"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
