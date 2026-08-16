import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata("Edit Vacancy - ScholarBase");
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import VacancyForm from "@/components/vacancies/VacancyForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export default async function EditVacancyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this vacancy.",
  );

  const vacancy = await prisma.jobVacancy.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      institution: true,
      deadline: true,
      description: true,
      notificationLink: true,
      applyLink: true,
      authorId: true,
    },
  });

  if (!vacancy) {
    notFound();
  }

  // Security Guard
  if (vacancy.authorId !== user.id) {
    throw new Error("You are not authorized to edit this vacancy.");
  }

  return (
    <CreateOrEditPageShell
      title="Edit Academic Vacancy"
      description="Update the job details, application deadlines, or links."
      backHref={`/vacancies/${vacancy.id}`}
      backLabel="← Cancel and Back to Vacancy"
    >
      <VacancyForm
        mode="edit"
        vacancyId={vacancy.id}
        initialValues={{
          title: vacancy.title,
          institution: vacancy.institution,
          deadline: new Date(vacancy.deadline).toISOString().slice(0, 10),
          description: vacancy.description,
          notificationLink: vacancy.notificationLink ?? "",
          applyLink: vacancy.applyLink ?? "",
        }}
      />
    </CreateOrEditPageShell>
  );
}
