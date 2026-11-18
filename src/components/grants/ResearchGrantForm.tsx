"use client";

import { Select } from "@/components/ui/Select";

import { useRouter } from "next/navigation";
import { createResearchGrant, updateResearchGrant } from "@/app/actions/grants";
import { useQueryClient } from "@tanstack/react-query";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { upsertToList } from "@/utils/cacheMutation";
import { CautionNote } from "@/components/ui/CautionNote";
import type { ResearchGrantWithAuthor } from "@/types/cards";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  GRANT_TITLE_TIP,
  GRANT_AMOUNT_TIP,
  GRANT_APPLY_LINK_TIP,
  GRANT_INFO_LINK_TIP,
  GRANT_DESCRIPTION_TIP,
} from "@/constants/tooltips";

import {
  MAX_RESEARCH_GRANT_TITLE,
  MAX_RESEARCH_GRANT_DESCRIPTION,
  MAX_RESEARCH_GRANT_APPLY_LINK,
  MAX_RESEARCH_GRANT_INFO_LINK,
  MAX_COMPENSATION_VALUE_LENGTH,
} from "@/lib/constants";
import { getRichTextLength } from "@/lib/html";
import {
  COMPENSATION_PERIODS,
  COURSE_CURRENCIES,
  DEFAULT_COMPENSATION_PERIOD,
  DEFAULT_COURSE_CURRENCY,
} from "@/lib/compensation";

export type ResearchGrantFormValues = {
  title: string;
  amount: string;
  amountValue: string;
  amountCurrency: string;
  amountPeriod: string;
  description: string;
  applyLink: string;
  infoLink: string;
};

export default function ResearchGrantForm({
  mode,
  grantId,
  initialValues,
}: {
  mode: "create" | "edit";
  grantId?: string;
  initialValues?: Partial<ResearchGrantFormValues>;
}) {
  const router = useRouter();
  const initial = {
    title: initialValues?.title ?? "",
    amount: initialValues?.amount ?? "",
    amountValue: initialValues?.amountValue ?? "",
    amountCurrency: initialValues?.amountCurrency ?? DEFAULT_COURSE_CURRENCY,
    amountPeriod: initialValues?.amountPeriod ?? DEFAULT_COMPENSATION_PERIOD,
    description: initialValues?.description ?? "",
    applyLink: initialValues?.applyLink ?? "",
    infoLink: initialValues?.infoLink ?? "",
  };

  const draftKey = mode === "edit" ? null : "draft_research_grant_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial,
  );
  const queryClient = useQueryClient();

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage:
        mode === "create"
          ? "Research grant added successfully!"
          : "Research grant updated successfully!",
      errorMessage:
        mode === "create"
          ? "Failed to save research grant."
          : "Failed to update research grant.",
      onSuccess: (response) => {
        if (response.success && response.data) {
          const data = response.data as ResearchGrantWithAuthor;
          upsertToList<ResearchGrantWithAuthor>(
            queryClient,
            ["grants"],
            data,
            mode,
          );
          router.push(`/grants/${data.id}`);
        }
      },
    },
  );

  const isDescriptionOverLimit =
    getRichTextLength(draftFields.description) > MAX_RESEARCH_GRANT_DESCRIPTION;
  const isFormOverLimit = isDescriptionOverLimit;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isFormOverLimit) return;

    const formData = new FormData(e.currentTarget);

    await submit(() => {
      if (mode === "edit" && grantId) {
        return updateResearchGrant(formData, grantId);
      }
      return createResearchGrant(formData);
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="sb-surface-strong flex flex-col gap-5 p-4 sm:p-6 md:p-10"
    >
      <CautionNote />
      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Grant Title
          <InfoTooltip message={GRANT_TITLE_TIP} />
        </label>
          <input
            name="title"
            placeholder="e.g., Early Career Research Grant 2026"
            className="sb-input"
            required
            maxLength={MAX_RESEARCH_GRANT_TITLE}
            value={draftFields.title}
            onChange={(e) => updateDraftField("title", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.title.length}/{MAX_RESEARCH_GRANT_TITLE} characters
          </div>
        </div>

        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Amount
            <InfoTooltip message={GRANT_AMOUNT_TIP} />
          </label>
          <div className="grid gap-2 sm:grid-cols-3">
            <input
              name="amountValue"
              type="number"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="e.g., 25000"
              className="sb-input min-w-0"
              value={draftFields.amountValue}
              onChange={(e) => updateDraftField("amountValue", e.target.value.slice(0, MAX_COMPENSATION_VALUE_LENGTH))}
            />
            <Select
              name="amountCurrency"
              value={draftFields.amountCurrency}
              containerClassName="w-full"
              aria-label="Grant amount currency"
              onChange={(e) => updateDraftField("amountCurrency", e.target.value)}
            >
              {COURSE_CURRENCIES.map(({ code }) => <option key={code} value={code}>{code}</option>)}
            </Select>
            <Select
              name="amountPeriod"
              value={draftFields.amountPeriod}
              containerClassName="w-full"
              aria-label="Grant amount basis"
              onChange={(e) => updateDraftField("amountPeriod", e.target.value)}
            >
              {COMPENSATION_PERIODS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
            </Select>
          </div>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.amountValue.length}/{MAX_COMPENSATION_VALUE_LENGTH} characters
          </div>
          <input type="hidden" name="amount" value={draftFields.amount} />
        </div>

        <div className="grid gap-5 md:grid-cols-2">
          <div>
            <label className="sb-label inline-flex items-center gap-1.5">
              Apply Link
              <InfoTooltip message={GRANT_APPLY_LINK_TIP} />
            </label>
            <input
              name="applyLink"
              type="url"
              pattern="https?://.+"
              placeholder="https://..."
              className="sb-input"
              maxLength={MAX_RESEARCH_GRANT_APPLY_LINK}
              value={draftFields.applyLink}
              onChange={(e) => updateDraftField("applyLink", e.target.value)}
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {draftFields.applyLink.length}/{MAX_RESEARCH_GRANT_APPLY_LINK} characters
            </div>
          </div>
          <div>
            <label className="sb-label inline-flex items-center gap-1.5">
              Info Link
              <InfoTooltip message={GRANT_INFO_LINK_TIP} />
            </label>
            <input
              name="infoLink"
              type="url"
              pattern="https?://.+"
              placeholder="https://..."
              className="sb-input"
              maxLength={MAX_RESEARCH_GRANT_INFO_LINK}
              value={draftFields.infoLink}
              onChange={(e) => updateDraftField("infoLink", e.target.value)}
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {draftFields.infoLink.length}/{MAX_RESEARCH_GRANT_INFO_LINK} characters
            </div>
          </div>
        </div>

        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            How to Apply
            <InfoTooltip message={GRANT_DESCRIPTION_TIP} />
          </label>
          <Editor
            maxLength={MAX_RESEARCH_GRANT_DESCRIPTION}
            value={draftFields.description}
            onChange={(data) => updateDraftField("description", data)}
          />
          <input
            type="hidden"
            name="description"
            value={draftFields.description}
          />
          
        </div>

      <div className="mt-2 flex justify-end gap-3">
        <FormCancelButton />
        <SubmitBtnWithAuth className="sb-button-accent" disabled={submitting || isFormOverLimit}>
          {mode === "edit" ? "Save Changes" : "Add Research Grant"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
