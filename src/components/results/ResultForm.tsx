"use client";

import { useRouter } from "next/navigation";
import { createResult, updateResult } from "@/app/actions/results";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useQueryClient } from "@tanstack/react-query";
import { upsertToList } from "@/utils/cacheMutation";
import { CautionNote } from "@/components/ui/CautionNote";
import {
  MAX_RESULT_TITLE,
  MAX_RESULT_CATEGORY,
  MAX_RESULT_CONDUCTING_BODY,
  MAX_RESULT_SESSION,
  MAX_RESULT_DESCRIPTION,
  MAX_RESULT_NOTIFICATION_LINK,
  MAX_RESULT_RESULT_LINK,
} from "@/lib/constants";
import type { ResultWithAuthor } from "@/types/cards";

export type ResultFormValues = {
  title: string;
  type: string;
  category: string;
  conductingBody: string;
  session: string;
  description: string;
  notificationLink: string;
  resultLink: string;
};

const RESULT_TYPES = [
  { value: "EXAM", label: "Exam Result" },
  { value: "ADMISSION", label: "Admission Result" },
  { value: "VACANCY", label: "Vacancy Result" },
  { value: "EVENT", label: "Event Result" },
  { value: "OTHER", label: "Other Result" },
];

export default function ResultForm({
  mode,
  resultId,
  initialValues,
}: {
  mode: "create" | "edit";
  resultId?: string;
  initialValues?: Partial<ResultFormValues>;
}) {
  const router = useRouter();
  const initial = {
    title: initialValues?.title ?? "",
    type: initialValues?.type ?? "EXAM",
    category: initialValues?.category ?? "",
    conductingBody: initialValues?.conductingBody ?? "",
    session: initialValues?.session ?? "",
    description: initialValues?.description ?? "",
    notificationLink: initialValues?.notificationLink ?? "",
    resultLink: initialValues?.resultLink ?? "",
  };

  const draftKey = mode === "edit" ? null : "draft_result_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial
  );
  const queryClient = useQueryClient();

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage:
        mode === "create"
          ? "Result published successfully!"
          : "Result updated successfully!",
      errorMessage:
        mode === "create"
          ? "Failed to publish result."
          : "Failed to update result.",
      onSuccess: (response) => {
        if (response.success && response.data) {
          const data = response.data as ResultWithAuthor;
          upsertToList<ResultWithAuthor>(
            queryClient,
            ["results"],
            data,
            mode,
          );
          router.push(`/results/${data.id}`);
        }
      },
    },
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    await submit(() => {
      if (mode === "edit" && resultId) {
        return updateResult(formData, resultId);
      } else {
        return createResult(formData);
      }
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
    >
      <CautionNote />
      <div>
        <label className="sb-label">Title</label>
        <input
          name="title"
          placeholder="e.g., UGC NET June 2024 Results Declared"
          className="sb-input"
          required
          maxLength={MAX_RESULT_TITLE}
          value={draftFields.title}
          onChange={(e) => updateDraftField("title", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.title.length}/{MAX_RESULT_TITLE} characters
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label">Result Type</label>
          <select
            name="type"
            className="sb-select"
            required
            value={draftFields.type}
            onChange={(e) => updateDraftField("type", e.target.value)}
          >
            {RESULT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="sb-label">Category (Optional)</label>
          <input
            name="category"
            placeholder="e.g., NET, JRF, SET, GATE"
            className="sb-input"
            maxLength={MAX_RESULT_CATEGORY}
            value={draftFields.category}
            onChange={(e) => updateDraftField("category", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.category.length}/{MAX_RESULT_CATEGORY} characters
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="sb-label">Conducting Body (Optional)</label>
          <input
            name="conductingBody"
            placeholder="e.g., UGC, NTA, CBSE"
            className="sb-input"
            maxLength={MAX_RESULT_CONDUCTING_BODY}
            value={draftFields.conductingBody}
            onChange={(e) => updateDraftField("conductingBody", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.conductingBody.length}/{MAX_RESULT_CONDUCTING_BODY} characters
          </div>
        </div>
        <div>
          <label className="sb-label">Session (Optional)</label>
          <input
            name="session"
            placeholder="e.g., June 2024, December 2024"
            className="sb-input"
            maxLength={MAX_RESULT_SESSION}
            value={draftFields.session}
            onChange={(e) => updateDraftField("session", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.session.length}/{MAX_RESULT_SESSION} characters
          </div>
        </div>
      </div>

      <div>
        <label className="sb-label">Description / Details</label>
        <Editor
          value={draftFields.description}
          onChange={(data) => updateDraftField("description", data)}
          maxLength={MAX_RESULT_DESCRIPTION}
        />
        <input
          type="hidden"
          name="description"
          value={draftFields.description}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {String(draftFields.description.length).replace(/(\d+)(?=.(\d{3})*$)/g, "$1,")}/{MAX_RESULT_DESCRIPTION} characters
        </div>
      </div>

      <div>
        <label className="sb-label">Official Notification URL (Optional)</label>
        <input
          type="url"
          name="notificationLink"
          placeholder="https://ugc.ac.in/notification.pdf"
          className="sb-input"
          maxLength={MAX_RESULT_NOTIFICATION_LINK}
          value={draftFields.notificationLink}
          onChange={(e) => updateDraftField("notificationLink", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.notificationLink.length}/{MAX_RESULT_NOTIFICATION_LINK} characters
        </div>
      </div>

      <div>
        <label className="sb-label">Result / Outcome URL (Optional)</label>
        <input
          type="url"
          name="resultLink"
          placeholder="https://ntaresults.nic.in/..."
          className="sb-input"
          maxLength={MAX_RESULT_RESULT_LINK}
          value={draftFields.resultLink}
          onChange={(e) => updateDraftField("resultLink", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.resultLink.length}/{MAX_RESULT_RESULT_LINK} characters
        </div>
      </div>

      <div className="mt-2 flex justify-end gap-3">
        <FormCancelButton />
        <SubmitBtnWithAuth
          className="sb-button-accent"
          loadingText={mode === "edit" ? "Saving..." : "Publishing..."}
          disabled={submitting}
        >
          {mode === "edit" ? "Save Changes" : "Publish Result"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
