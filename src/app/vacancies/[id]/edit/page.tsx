import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata(
  "Edit Vacancy - ScholarBase",
);
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import VacancyForm from "@/components/vacancies/VacancyForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { EDIT_PAGE_TEXT } from "@/constants/seo";
import { stripMailtoPrefix } from "@/lib/email-normalizer";

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
      department: true,
      subject: true,
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
      title={EDIT_PAGE_TEXT.vacancies.title}
      description={EDIT_PAGE_TEXT.vacancies.description}
      backHref={`/vacancies/${vacancy.id}`}
      backLabel="Cancel and Back to Vacancy"
    >
      <VacancyForm
        mode="edit"
        vacancyId={vacancy.id}
        initialValues={{
          title: vacancy.title,
          institution: vacancy.institution,
          department: vacancy.department ?? "",
          subject: vacancy.subject ?? "",
          deadline: new Date(vacancy.deadline).toISOString().slice(0, 10),
          description: vacancy.description,
          notificationLink: vacancy.notificationLink ?? "",
          // Legacy rows may store `mailto:a@b.com` from the old writer —
          // prefill the bare email so the user never sees/edits `mailto:` text.
          applyLink: vacancy.applyLink ? stripMailtoPrefix(vacancy.applyLink) : "",
        }}
      />
    </CreateOrEditPageShell>
  );
}
