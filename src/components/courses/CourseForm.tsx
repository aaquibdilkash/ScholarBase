"use client";

import { createCourse, updateCourse } from "@/app/actions/courses";
import { useQueryClient } from "@tanstack/react-query";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
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
      successMessage: "Course added successfully!",
      errorMessage: "Failed to save course.",
      onSuccess: (response) => {
        if (!response.success || !response.data) return;
        const data = response.data as CourseWithAuthor;
        if (mode === "create") {
          queryClient.setQueriesData(
            { queryKey: ["courses"] },
            (oldData: CourseWithAuthor[] = []) => [data, ...oldData],
          );
        } else {
          queryClient.setQueriesData(
            { queryKey: ["courses"] },
            (oldData: CourseWithAuthor[] = []) =>
              oldData.map((c) => (c.id === data.id ? data : c)),
          );
        }
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
        <label className="sb-label">Course Title</label>
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
          <label className="sb-label">Provider</label>
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
          <label className="sb-label">Instructor</label>
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
          <label className="sb-label">Format</label>
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
          <label className="sb-label">Level</label>
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
          <label className="sb-label">Price</label>
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
          <label className="sb-label">Duration</label>
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
        <label className="sb-label">Course Link</label>
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
        <label className="sb-label">
          Learning Outcomes and Instructor Notes
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
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {String(draftFields.description.length).replace(
            /(\d+)(?=.(\d{3})*$)/g,
            "$1,",
          )}
          /{MAX_COURSE_DESCRIPTION} characters
        </div>
      </div>

      <div className="mt-2 flex justify-end gap-3">
        {mode === "create" && <FormCancelButton href="/learn" />}
        <SubmitBtnWithAuth className="sb-button-accent" disabled={submitting}>
          {mode === "edit" ? "Save Changes" : "Add Course"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
