import type { Metadata } from "next";
import CourseForm from "@/components/courses/CourseForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.learn.title,
  description: SEO_CREATE_PAGES.learn.description,
  robots: { index: true, follow: true },
};

export default function NewCoursePage() {
  return (
    <CreateOrEditPageShell
      title={SEO_CREATE_PAGES.learn.title}
      description={SEO_CREATE_PAGES.learn.description}
      backHref="/learn"
      backLabel="Back to Courses"
    >
      <CourseForm mode="create" />
    </CreateOrEditPageShell>
  );
}
