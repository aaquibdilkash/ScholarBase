import type { Metadata } from "next";
import CourseForm from "@/components/courses/CourseForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export const metadata: Metadata = {
  title: "Add Course",
  description: "Share a research learning course and its outcomes, instructor, provider, and link.",
  robots: { index: false, follow: true },
};

export default function NewCoursePage() {
  return (
    <CreateOrEditPageShell
      title="Add Course"
      description="Share a course that helps scholars learn research skills."
      backHref="/learn"
      backLabel="← Back to Courses"
    >
      <CourseForm mode="create" />
    </CreateOrEditPageShell>
  );
}
