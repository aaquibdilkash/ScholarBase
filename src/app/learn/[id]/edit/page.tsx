import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata("Edit Course - ScholarBase");
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import CourseForm from "@/components/courses/CourseForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireCurrentUser("You must be logged in to edit this course.");

  const course = await prisma.course.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      provider: true,
      instructor: true,
      format: true,
      level: true,
      price: true,
      duration: true,
      link: true,
      description: true,
      authorId: true,
    },
  });

  if (!course) notFound();
  if (course.authorId !== user.id) throw new Error("You are not authorized to edit this course.");

  return (
    <CreateOrEditPageShell
      title="Edit Course"
      description="Update the course details, learning outcomes, or link."
      backHref={`/learn/${course.id}`}
      backLabel="← Cancel and Back to Course"
    >
      <CourseForm
        mode="edit"
        courseId={course.id}
        initialValues={{
          title: course.title,
          provider: course.provider ?? "",
          instructor: course.instructor ?? "",
          format: course.format ?? "",
          level: course.level ?? "",
          price: course.price ?? "",
          duration: course.duration ?? "",
          link: course.link,
          description: course.description,
        }}
      />
    </CreateOrEditPageShell>
  );
}
