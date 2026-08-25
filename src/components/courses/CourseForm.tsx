"use client";

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
  MAX_COURSE_FORMAT,
  MAX_COURSE_LEVEL,
  MAX_COURSE_PRICE,
  MAX_COURSE_DURATION,
  MAX_COURSE_URL,
  MAX_COURSE_DESCRIPTION,
} from "@/lib/constants";
import type { CourseWithAuthor } from "@/types/cards";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  COURSE_TITLE_TIP,
  COURSE_PROVIDER_TIP,
  COURSE_INSTRUCTOR_TIP,
  COURSE_FORMAT_TIP,
  COURSE_LEVEL_TIP,
  COURSE_PRICE_TIP,
  COURSE_DURATION_TIP,
  COURSE_LINK_TIP,
  COURSE_DESCRIPTION_TIP,
} from "@/constants/tooltips";

export type CourseFormValues = {
  title: string;
  provider: string;
  instructor: string;
  format: string;
  level: string;
  price: string;
  duration: string;
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
    format: initialValues?.format ?? "",
    level: initialValues?.level ?? "",
    price: initialValues?.price ?? "",
    duration: initialValues?.duration ?? "",
    link: initialValues?.link ?? "",
    description: initialValues?.description ?? "",
  };

  const draftKey = mode === "edit" ? null : "draft_course_create";
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

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
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
      className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10"
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

      <div className="grid gap-5 md:grid-cols-2">
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
      </div>

      <div className="grid gap-5 md:grid-cols-4">
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Format
            <InfoTooltip message={COURSE_FORMAT_TIP} />
          </label>
          <input
            name="format"
            placeholder="Video, cohort, self-paced"
            className="sb-input"
            maxLength={MAX_COURSE_FORMAT}
            value={draftFields.format}
            onChange={(e) => updateDraftField("format", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.format.length}/{MAX_COURSE_FORMAT} characters
          </div>
        </div>
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Level
            <InfoTooltip message={COURSE_LEVEL_TIP} />
          </label>
          <input
            name="level"
            placeholder="Beginner, advanced..."
            className="sb-input"
            maxLength={MAX_COURSE_LEVEL}
            value={draftFields.level}
            onChange={(e) => updateDraftField("level", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.level.length}/{MAX_COURSE_LEVEL} characters
          </div>
        </div>
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Price
            <InfoTooltip message={COURSE_PRICE_TIP} />
          </label>
          <input
            name="price"
            placeholder="Free, paid, INR 499..."
            className="sb-input"
            maxLength={MAX_COURSE_PRICE}
            value={draftFields.price}
            onChange={(e) => updateDraftField("price", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.price.length}/{MAX_COURSE_PRICE} characters
          </div>
        </div>
        <div>
          <label className="sb-label inline-flex items-center gap-1.5">
            Duration
            <InfoTooltip message={COURSE_DURATION_TIP} />
          </label>
          <input
            name="duration"
            placeholder="2 hours, 4 weeks..."
            className="sb-input"
            maxLength={MAX_COURSE_DURATION}
            value={draftFields.duration}
            onChange={(e) => updateDraftField("duration", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.duration.length}/{MAX_COURSE_DURATION} characters
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
        <SubmitBtnWithAuth className="sb-button-accent" disabled={submitting}>
          {mode === "edit" ? "Save Changes" : "Add Course"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
