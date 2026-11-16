"use client";
import { Select } from "@/components/ui/Select";

import { useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { createCourse, updateCourse } from "@/app/actions/courses";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { upsertToList } from "@/utils/cacheMutation";
import { CautionNote } from "@/components/ui/CautionNote";
import {
  MAX_COURSE_TITLE,
  MAX_COURSE_PROVIDER,
  MAX_COURSE_INSTRUCTOR,
  MAX_COURSE_URL,
  MAX_COURSE_DESCRIPTION,
} from "@/lib/constants";
import { getRichTextLength } from "@/lib/html";
import type { CourseWithAuthor } from "@/types/cards";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  COURSE_CURRENCIES,
  COURSE_PRICING_OPTIONS,
  COURSE_PRICE_MAX_LENGTH,
  DEFAULT_COURSE_CURRENCY,
} from "@/lib/course-currency";
import {
  COURSE_DURATION_MAX_LENGTH,
  COURSE_DURATION_UNITS,
} from "@/lib/course-duration";
import { COURSE_LANGUAGES } from "@/lib/course-language";
import {
  COURSE_TITLE_TIP,
  COURSE_PROVIDER_TIP,
  COURSE_INSTRUCTOR_TIP,
  COURSE_LANGUAGE_TIP,
  COURSE_FORMAT_TIP,
  COURSE_LEVEL_TIP,
  COURSE_PRICING_TIP,
  COURSE_PRICE_TIP,
  COURSE_DURATION_TIP,
  COURSE_LINK_TIP,
  COURSE_DESCRIPTION_TIP,
} from "@/constants/tooltips";

export type CourseFormValues = {
  title: string;
  provider: string;
  instructor: string;
  language: string;
  format: string;
  level: string;
  pricing: string;
  price: string;
  currency: string;
  durationValue: string;
  durationUnit: string;
  link: string;
  description: string;
};

export default function CourseForm({
  mode,
  courseId,
  initialValues,
}: {
  mode: "create" | "edit";
  courseId?: string;
  initialValues?: Partial<CourseFormValues>;
}) {
  const router = useRouter();
  const initial = {
    title: initialValues?.title ?? "",
    provider: initialValues?.provider ?? "",
    instructor: initialValues?.instructor ?? "",
    language: initialValues?.language ?? "",
    format: initialValues?.format ?? "",
    level: initialValues?.level ?? "",
    pricing: initialValues?.pricing ?? "",
    price: initialValues?.price ?? "",
    currency: initialValues?.currency ?? DEFAULT_COURSE_CURRENCY,
    durationValue: initialValues?.durationValue ?? "",
    durationUnit: initialValues?.durationUnit ?? "",
    link: initialValues?.link ?? "",
    description: initialValues?.description ?? "",
  };

  // v2: price/durationValue are strings now (a controlled numeric input whose
  // value is re-parsed on every keystroke drops the decimal point). The old key
  // holds numbers and must not be restored into the string model.
  const draftKey = mode === "edit" ? null : "draft_course_create_v2";
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
          ? "Course added successfully!"
          : "Course updated successfully!",
      errorMessage:
        mode === "create"
          ? "Failed to save course."
          : "Failed to update course.",
      onSuccess: (response) => {
        if (!response.success || !response.data) return;
        const data = response.data as CourseWithAuthor;
        upsertToList<CourseWithAuthor>(
          queryClient,
          ["courses"],
          data,
          mode,
        );
        router.push(`/learn/${data.id}`);
      },
    },
  );

  const isDescriptionOverLimit =
    getRichTextLength(draftFields.description) > MAX_COURSE_DESCRIPTION;
  const isFormOverLimit = isDescriptionOverLimit;
  // `Select` renders a sr-only native control, so HTML `required` would block
  // submit with an error the user cannot focus. Block here instead and let the
  // action reject a missing value as a second line of defence.
  const isPricingMissing = draftFields.pricing.length === 0;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isFormOverLimit || isPricingMissing) return;

    const formData = new FormData(e.currentTarget);
    await submit(() =>
      mode === "edit" && courseId
        ? updateCourse(formData, courseId)
        : createCourse(formData),
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      className="sb-surface-strong flex flex-col gap-5 p-4 sm:p-6 md:p-10"
    >
      <CautionNote />
      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Course Title
          <InfoTooltip message={COURSE_TITLE_TIP} />
        </label>
        <input
          name="title"
          placeholder="e.g., Research Methodology for Beginners"
          className="sb-input"
          required
          maxLength={MAX_COURSE_TITLE}
          value={draftFields.title}
          onChange={(e) => updateDraftField("title", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.title.length}/{MAX_COURSE_TITLE} characters
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Provider
            <InfoTooltip message={COURSE_PROVIDER_TIP} />
          </label>
          <input
            name="provider"
            placeholder="YouTube, Udemy, Unacademy, university..."
            className="sb-input"
            maxLength={MAX_COURSE_PROVIDER}
            value={draftFields.provider}
            onChange={(e) => updateDraftField("provider", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.provider.length}/{MAX_COURSE_PROVIDER} characters
          </div>
        </div>
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Instructor
            <InfoTooltip message={COURSE_INSTRUCTOR_TIP} />
          </label>
          <input
            name="instructor"
            placeholder="Instructor or channel name"
            className="sb-input"
            maxLength={MAX_COURSE_INSTRUCTOR}
            value={draftFields.instructor}
            onChange={(e) => updateDraftField("instructor", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.instructor.length}/{MAX_COURSE_INSTRUCTOR} characters
          </div>
        </div>
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Language
            <InfoTooltip message={COURSE_LANGUAGE_TIP} />
          </label>
          <Select
            name="language"
            className="sb-input"
            value={draftFields.language}
            onChange={(e) => updateDraftField("language", e.target.value)}
          >
            <option value="">Select language</option>
            {COURSE_LANGUAGES.map((language) => (
              <option key={language} value={language}>
                {language}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Format
            <InfoTooltip message={COURSE_FORMAT_TIP} />
          </label>
          <Select
            name="format"
            className="sb-input"
            value={draftFields.format}
            onChange={(e) => updateDraftField("format", e.target.value)}
          >
            <option value="">Select format</option>
            <option value="Video">Video</option>
            <option value="Live / Cohort-based">Live / Cohort-based</option>
            <option value="Self-paced">Self-paced</option>
            <option value="Text / Reading">Text / Reading</option>
            <option value="Interactive / Project-based">Interactive / Project-based</option>
            <option value="Workshop / Bootcamp">Workshop / Bootcamp</option>
          </Select>
        </div>
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Level
            <InfoTooltip message={COURSE_LEVEL_TIP} />
          </label>
          <Select
            name="level"
            className="sb-input"
            value={draftFields.level}
            onChange={(e) => updateDraftField("level", e.target.value)}
          >
            <option value="">Select level</option>
            <option value="Beginner">Beginner</option>
            <option value="Intermediate">Intermediate</option>
            <option value="Advanced">Advanced</option>
          </Select>
        </div>
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Duration
            <InfoTooltip message={COURSE_DURATION_TIP} />
          </label>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <input
                name="durationValue"
                type="number"
                min="0"
                step="any"
                inputMode="decimal"
                placeholder="e.g., 1.5"
                className="sb-input"
                value={draftFields.durationValue}
                onChange={(e) =>
                  updateDraftField(
                    "durationValue",
                    e.target.value.slice(0, COURSE_DURATION_MAX_LENGTH),
                  )
                }
              />
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {draftFields.durationValue.length}/{COURSE_DURATION_MAX_LENGTH}{" "}
                characters
              </div>
            </div>
            <Select
              name="durationUnit"
              className="sb-input flex-1 self-start"
              value={draftFields.durationUnit}
              onChange={(e) => updateDraftField("durationUnit", e.target.value)}
            >
              <option value="">Unit</option>
              {COURSE_DURATION_UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit[0].toUpperCase() + unit.slice(1)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Free or Paid
            <InfoTooltip message={COURSE_PRICING_TIP} />
          </label>
          <Select
            name="pricing"
            className="sb-input"
            value={draftFields.pricing}
            onChange={(e) => updateDraftField("pricing", e.target.value)}
          >
            <option value="">Select pricing</option>
            {COURSE_PRICING_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
        <div className="md:col-span-2">
          <label className="sb-label inline-flex items-center gap-1.5">
            Price
            <InfoTooltip message={COURSE_PRICE_TIP} />
          </label>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1">
              <input
                name="price"
                type="number"
                min="0"
                step="0.01"
                inputMode="decimal"
                placeholder="e.g., 499 or 9.99"
                className="sb-input"
                value={draftFields.price}
                onChange={(e) =>
                  updateDraftField(
                    "price",
                    e.target.value.slice(0, COURSE_PRICE_MAX_LENGTH),
                  )
                }
              />
              <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {draftFields.price.length}/{COURSE_PRICE_MAX_LENGTH} characters
              </div>
            </div>
            <Select
              name="currency"
              value={draftFields.currency}
              className="w-32 shrink-0 self-start"
              aria-label="Price currency"
              onChange={(e) => updateDraftField("currency", e.target.value)}
            >
              {COURSE_CURRENCIES.map(({ code, label }) => (
                <option key={code} value={code}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Course Link
          <InfoTooltip message={COURSE_LINK_TIP} />
        </label>
        <input
          name="link"
          type="url"
          pattern="https?://.+"
          placeholder="https://..."
          className="sb-input"
          required
          maxLength={MAX_COURSE_URL}
          value={draftFields.link}
          onChange={(e) => updateDraftField("link", e.target.value)}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {draftFields.link.length}/{MAX_COURSE_URL} characters
        </div>
      </div>

      <div>
        <label className="sb-label inline-flex items-center gap-1.5">
          Learning Outcomes and Instructor Notes
          <InfoTooltip message={COURSE_DESCRIPTION_TIP} />
        </label>
        <Editor
          value={draftFields.description}
          onChange={(data) => updateDraftField("description", data)}
          maxLength={MAX_COURSE_DESCRIPTION}
        />
        <input
          type="hidden"
          name="description"
          value={draftFields.description}
        />
      </div>

      <div className="mt-2 flex justify-end gap-3">
        <FormCancelButton />
        <SubmitBtnWithAuth className="sb-button-accent" disabled={submitting || isFormOverLimit || isPricingMissing}>
          {mode === "edit" ? "Save Changes" : "Add Course"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
