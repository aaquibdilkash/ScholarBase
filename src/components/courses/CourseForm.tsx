"use client";

import { createCourse, updateCourse } from "@/app/actions/courses";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";

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
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(draftKey, initial);
  const { submitting, submit } = useFormSubmit(mode !== "edit" ? resetDraft : undefined, {
    resetOnSuccess: mode !== "edit",
    successMessage: "Course added successfully!",
    errorMessage: "Failed to save course.",
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    await submit(() => mode === "edit" && courseId ? updateCourse(formData, courseId) : createCourse(formData));
  }

  return (
    <form onSubmit={onSubmit} className="sb-surface-strong flex flex-col gap-5 p-8 md:p-10">
      <div>
        <label className="sb-label">Course Title</label>
        <input name="title" placeholder="e.g., Research Methodology for Beginners" className="sb-input" required value={draftFields.title} onChange={(e) => updateDraftField("title", e.target.value)} />
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <label className="sb-label">Provider</label>
          <input name="provider" placeholder="YouTube, Udemy, Unacademy, university..." className="sb-input" value={draftFields.provider} onChange={(e) => updateDraftField("provider", e.target.value)} />
        </div>
        <div>
          <label className="sb-label">Instructor</label>
          <input name="instructor" placeholder="Instructor or channel name" className="sb-input" value={draftFields.instructor} onChange={(e) => updateDraftField("instructor", e.target.value)} />
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-4">
        <div>
          <label className="sb-label">Format</label>
          <input name="format" placeholder="Video, cohort, self-paced" className="sb-input" value={draftFields.format} onChange={(e) => updateDraftField("format", e.target.value)} />
        </div>
        <div>
          <label className="sb-label">Level</label>
          <input name="level" placeholder="Beginner, advanced..." className="sb-input" value={draftFields.level} onChange={(e) => updateDraftField("level", e.target.value)} />
        </div>
        <div>
          <label className="sb-label">Price</label>
          <input name="price" placeholder="Free, paid, INR 499..." className="sb-input" value={draftFields.price} onChange={(e) => updateDraftField("price", e.target.value)} />
        </div>
        <div>
          <label className="sb-label">Duration</label>
          <input name="duration" placeholder="2 hours, 4 weeks..." className="sb-input" value={draftFields.duration} onChange={(e) => updateDraftField("duration", e.target.value)} />
        </div>
      </div>

      <div>
        <label className="sb-label">Course Link</label>
        <input name="link" type="url" placeholder="https://..." className="sb-input" required value={draftFields.link} onChange={(e) => updateDraftField("link", e.target.value)} />
      </div>

      <div>
        <label className="sb-label">Learning Outcomes and Instructor Notes</label>
        <Editor value={draftFields.description} onChange={(data) => updateDraftField("description", data)} />
        <input type="hidden" name="description" value={draftFields.description} />
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
