"use client";

import { createAcademicPosition, updateAcademicPosition } from "@/app/actions/academic-positions";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { CautionNote } from "@/components/ui/CautionNote";
import { getTodayString } from "@/lib/date";
import {
  MAX_POSITION_TITLE,
  MAX_POSITION_INSTITUTION,
  MAX_POSITION_DEPARTMENT,
  MAX_POSITION_SUBJECT,
  MAX_POSITION_SALARY,
  MAX_POSITION_DURATION,
  MAX_POSITION_LOCATION,
  MAX_POSITION_NOTIFICATION_LINK,
  MAX_POSITION_APPLY_LINK,
  MAX_POSITION_DESCRIPTION,
} from "@/lib/constants";
import { POSITION_TYPES, EMPLOYMENT_TYPES } from "@/lib/academic-positions";
import { getRichTextLength } from "@/lib/html";
import { actionErrorMessage } from "@/lib/utils";
import type { AcademicPositionWithAuthor } from "@/types/cards";
import { upsertToList } from "@/utils/cacheMutation";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  POSITION_TYPE_TIP,
  EMPLOYMENT_TYPE_TIP,
  POSITION_TITLE_TIP,
  POSITION_INSTITUTION_TIP,
  POSITION_DEPARTMENT_TIP,
  POSITION_SUBJECT_TIP,
  POSITION_SALARY_TIP,
  POSITION_DURATION_TIP,
  POSITION_START_DATE_TIP,
  POSITION_LOCATION_TIP,
  POSITION_REMOTE_TIP,
  POSITION_DEADLINE_TIP,
  POSITION_DESCRIPTION_TIP,
  POSITION_NOTIFICATION_LINK_TIP,
  POSITION_APPLY_LINK_TIP,
} from "@/constants/tooltips";

export type AcademicPositionFormValues = {
  title: string;
  institution: string;
  department: string;
  subject: string;
  positionType: string;
  employmentType: string;
  salaryOrStipend: string;
  contractDuration: string;
  startDate: string;
  location: string;
  isRemote: boolean;
  deadline: string;
  description: string;
  notificationLink: string;
  applyLink: string;
};

export default function AcademicPositionForm({
  mode,
  academicPositionId,
  initialValues,
}: {
  mode: "create" | "edit";
  academicPositionId?: string;
  initialValues?: Partial<AcademicPositionFormValues>;
}) {
  const initial = {
    title: initialValues?.title ?? "",
    institution: initialValues?.institution ?? "",
    department: initialValues?.department ?? "",
    subject: initialValues?.subject ?? "",
    positionType: initialValues?.positionType ?? "POSTDOC",
    employmentType: initialValues?.employmentType ?? "OTHER",
    salaryOrStipend: initialValues?.salaryOrStipend ?? "",
    contractDuration: initialValues?.contractDuration ?? "",
    startDate: initialValues?.startDate ?? "",
    location: initialValues?.location ?? "",
    isRemote: initialValues?.isRemote ?? false,
    deadline: initialValues?.deadline ?? "",
    description: initialValues?.description ?? "",
    notificationLink: initialValues?.notificationLink ?? "",
    applyLink: initialValues?.applyLink ?? "",
  };

  const draftKey = mode === "edit" ? null : "draft_position_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial,
  );

  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();

  const { mutate: create, isPending: isCreating } = useMutation({
    mutationFn: createAcademicPosition,
    onSuccess: (result) => {
      if (result.success && result.data) {
        toast("Academic position posted successfully!", "success");
        upsertToList<AcademicPositionWithAuthor>(
          queryClient,
          ["academicPositions"],
          result.data as AcademicPositionWithAuthor,
          "create",
        );
        resetDraft();
        router.push('/academic-positions');
      } else {
        toast(actionErrorMessage(result, "Failed to post this position."), "error");
      }
    },
    onError: (error) => {
      toast(error.message, "error");
    },
  });

  const { mutate: update, isPending: isUpdating } = useMutation({
    mutationFn: (data: { formData: FormData, academicPositionId: string }) => updateAcademicPosition(data.formData, data.academicPositionId),
    onSuccess: (result) => {
      if (result?.success && result?.data) {
        const updatedPosition = result.data as AcademicPositionWithAuthor;
        toast("Academic position updated successfully!", "success");

        // Update list cache across every cached variant (e.g. `["academicPositions", ""]`,
        // `["academicPositions", "remote"]`) — the captured `q` goes stale after navigation.
        upsertToList<AcademicPositionWithAuthor>(
          queryClient,
          ["academicPositions"],
          updatedPosition,
          "edit",
        );

        // Update detail cache
        queryClient.setQueryData(['academicPosition', updatedPosition.id], updatedPosition);
        
        router.push(`/academic-positions/${updatedPosition.id}`);
      } else {
        toast(actionErrorMessage(result, "Failed to update this position."), "error");
      }
    },
    onError: (error) => {
      toast(error.message, "error");
    },
  });

  const today = getTodayString();

  const isDescriptionOverLimit =
    getRichTextLength(draftFields.description) > MAX_POSITION_DESCRIPTION;
  const isFormOverLimit = isDescriptionOverLimit;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isFormOverLimit) return;

    const formData = new FormData(e.currentTarget);

    if (mode === "edit" && academicPositionId) {
      update({ formData, academicPositionId });
    } else {
      create(formData);
    }
  }

  const isPending = isCreating || isUpdating;

return (
    <form
      onSubmit={onSubmit}
      className="sb-surface-strong flex flex-col gap-5 p-4 sm:p-6 md:p-10"
    >
         <CautionNote />
      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Position Title
          <InfoTooltip message={POSITION_TITLE_TIP} />
        </label>
        <input
          name="title"
          placeholder="e.g., Assistant Professor (Contractual)"
          className="sb-input"
          required
          maxLength={MAX_POSITION_TITLE}
          value={draftFields.title}
          onChange={(e) => updateDraftField("title", e.target.value)}
          disabled={isPending}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.title.length}/{MAX_POSITION_TITLE} characters
        </div>
      </div>

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Position Type
          <InfoTooltip message={POSITION_TYPE_TIP} />
        </label>
        <select
          name="positionType"
          className="sb-input"
          value={draftFields.positionType}
          onChange={(e) => updateDraftField("positionType", e.target.value)}
          disabled={isPending}
        >
          {POSITION_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Employment Type
          <InfoTooltip message={EMPLOYMENT_TYPE_TIP} />
        </label>
        <select
          name="employmentType"
          className="sb-input"
          value={draftFields.employmentType}
          onChange={(e) => updateDraftField("employmentType", e.target.value)}
          disabled={isPending}
        >
          {EMPLOYMENT_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Institution / College
          <InfoTooltip message={POSITION_INSTITUTION_TIP} />
        </label>
        <input
          name="institution"
          placeholder="e.g., Delhi University"
          className="sb-input"
          required
          maxLength={MAX_POSITION_INSTITUTION}
          value={draftFields.institution}
          onChange={(e) => updateDraftField("institution", e.target.value)}
          disabled={isPending}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.institution.length}/{MAX_POSITION_INSTITUTION} characters
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Department (Optional)
            <InfoTooltip message={POSITION_DEPARTMENT_TIP} />
          </label>
          <input
            name="department"
            placeholder="e.g., Department of Physics"
            className="sb-input"
            maxLength={MAX_POSITION_DEPARTMENT}
            value={draftFields.department}
            onChange={(e) => updateDraftField("department", e.target.value)}
            disabled={isPending}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.department.length}/{MAX_POSITION_DEPARTMENT} characters
          </div>
        </div>

        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Research Group / Supervisor (Optional)
            <InfoTooltip message={POSITION_SUBJECT_TIP} />
          </label>
          <input
            name="subject"
            placeholder="e.g., Quantum Optics"
            className="sb-input"
            maxLength={MAX_POSITION_SUBJECT}
            value={draftFields.subject}
            onChange={(e) => updateDraftField("subject", e.target.value)}
            disabled={isPending}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.subject.length}/{MAX_POSITION_SUBJECT} characters
          </div>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Salary / Stipend (Optional)
            <InfoTooltip message={POSITION_SALARY_TIP} />
          </label>
          <input
            name="salaryOrStipend"
            placeholder="e.g., USD 45,000/year"
            className="sb-input"
            maxLength={MAX_POSITION_SALARY}
            value={draftFields.salaryOrStipend}
            onChange={(e) => updateDraftField("salaryOrStipend", e.target.value)}
            disabled={isPending}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.salaryOrStipend.length}/{MAX_POSITION_SALARY} characters
          </div>
        </div>

        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Contract Duration (Optional)
            <InfoTooltip message={POSITION_DURATION_TIP} />
          </label>
          <input
            name="contractDuration"
            placeholder="e.g., 2 years"
            className="sb-input"
            maxLength={MAX_POSITION_DURATION}
            value={draftFields.contractDuration}
            onChange={(e) => updateDraftField("contractDuration", e.target.value)}
            disabled={isPending}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.contractDuration.length}/{MAX_POSITION_DURATION} characters
          </div>
        </div>

        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Location (Optional)
            <InfoTooltip message={POSITION_LOCATION_TIP} />
          </label>
          <input
            name="location"
            placeholder="e.g., Cambridge, United Kingdom"
            className="sb-input"
            maxLength={MAX_POSITION_LOCATION}
            value={draftFields.location}
            onChange={(e) => updateDraftField("location", e.target.value)}
            disabled={isPending}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.location.length}/{MAX_POSITION_LOCATION} characters
          </div>
        </div>

        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Start Date (Optional)
            <InfoTooltip message={POSITION_START_DATE_TIP} />
          </label>
          <input
            type="date"
            name="startDate"
            className="sb-input"
            value={draftFields.startDate}
            onChange={(e) => updateDraftField("startDate", e.target.value)}
            disabled={isPending}
          />
        </div>
      </div>

      <label className="inline-flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <input
          type="checkbox"
          name="isRemote"
          className="h-4 w-4 rounded border-slate-300"
          checked={draftFields.isRemote}
          onChange={(e) => updateDraftField("isRemote", e.target.checked)}
          disabled={isPending}
        />
        Remote / online position
        <InfoTooltip message={POSITION_REMOTE_TIP} />
      </label>

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Last Date to Apply
          <InfoTooltip message={POSITION_DEADLINE_TIP} />
        </label>
        <input
          type="date"
          name="deadline"
          className="sb-input"
          required
          min={today}
          value={draftFields.deadline}
          onChange={(e) => updateDraftField("deadline", e.target.value)}
          disabled={isPending}
        />
      </div>

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Details (Qualifications, Responsibilities)
          <InfoTooltip message={POSITION_DESCRIPTION_TIP} />
        </label>
        <Editor
          value={draftFields.description}
          onChange={(data) => updateDraftField("description", data)}
          maxLength={MAX_POSITION_DESCRIPTION}
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
          <InfoTooltip message={POSITION_NOTIFICATION_LINK_TIP} />
        </label>
        <input
          type="url"
          pattern="https?://.+"
          name="notificationLink"
          placeholder="https://institution.org/jobs/advt-2026.pdf"
          className="sb-input"
          required
          maxLength={MAX_POSITION_NOTIFICATION_LINK}
          value={draftFields.notificationLink}
          onChange={(e) => updateDraftField("notificationLink", e.target.value)}
          disabled={isPending}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.notificationLink.length}/{MAX_POSITION_NOTIFICATION_LINK} characters
        </div>
      </div>

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Application Link / Email
          <InfoTooltip message={POSITION_APPLY_LINK_TIP} />
        </label>
        <input
          type="text"
          name="applyLink"
          placeholder="https://recruitment.portal or hr@inst.edu"
          className="sb-input"
          required
          maxLength={MAX_POSITION_APPLY_LINK}
          value={draftFields.applyLink}
          onChange={(e) => updateDraftField("applyLink", e.target.value)}
          disabled={isPending}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.applyLink.length}/{MAX_POSITION_APPLY_LINK} characters
        </div>
      </div>

      <div className="mt-2 flex justify-end gap-3">
        <FormCancelButton />
        <SubmitBtnWithAuth
          className="sb-button-accent"
          disabled={isPending || isFormOverLimit}
          loadingText={mode === "edit" ? "Saving..." : "Posting..."}
        >
          {mode === "edit" ? "Save Changes" : "Post Position"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
