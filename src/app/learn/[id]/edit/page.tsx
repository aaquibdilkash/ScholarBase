import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata(
  "Edit Course - ScholarBase",
);
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import CourseForm from "@/components/courses/CourseForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { EDIT_PAGE_TEXT } from "@/constants/seo";

export default async function EditCoursePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this course.",
  );

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
  if (course.authorId !== user.id)
    throw new Error("You are not authorized to edit this course.");

  const durationParts = (course.duration ?? "").split(" ");
  const durationValue =
    durationParts.length >= 2 ? Number(durationParts[0]) || 0 : 0;
  const durationUnit =
    durationParts.length >= 2 ? durationParts.slice(1).join(" ") : "";

  return (
    <CreateOrEditPageShell
      title={EDIT_PAGE_TEXT.learn.title}
      description={EDIT_PAGE_TEXT.learn.description}
      backHref={`/learn/${course.id}`}
      backLabel="Cancel and Back to Course"
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
          price: typeof course.price === "number" ? course.price : 0,
          durationValue: Number.isFinite(durationValue) ? durationValue : 0,
          durationUnit,
          link: course.link,
          description: course.description,
        }}
      />
    </CreateOrEditPageShell>
  );
}
