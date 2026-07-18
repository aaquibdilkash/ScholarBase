import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth";
import VacancyForm from "@/components/vacancies/VacancyForm";

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
    <main className="mx-auto max-w-4xl py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={`/vacancies/${vacancy.id}`}
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Cancel and Back to Vacancy
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Edit Academic Vacancy
        </h1>
        <p className="mt-2 text-slate-600">
          Update the job details, application deadlines, or links.
        </p>
      </div>

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
    </main>
  );
}
