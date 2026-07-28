import { notFound } from "next/navigation";
import Link from "next/link";
import SurveyForm from "@/components/surveys/SurveyForm";
import { createClient } from "@/utils/supabase/server";
import { getSurvey } from "@/app/actions/surveys";

export default async function EditSurveyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const survey = await getSurvey(id, user?.id);
  if (!survey) notFound();
  if (user?.id !== survey.author.id) notFound();

  // Serialize dates for client component
  const serializedSurvey = {
    ...survey,
    createdAt: survey.createdAt.toISOString(),
    updatedAt: survey.updatedAt.toISOString(),
    questions: survey.questions.map((q) => ({
      ...q,
      createdAt: q.createdAt.toISOString(),
      updatedAt: q.updatedAt.toISOString(),
    })),
    comments: undefined,
    votes: undefined,
    author: undefined,
    _count: undefined,
  };

  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href={`/surveys/${id}`}
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Survey
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Edit Research Survey
        </h1>
        <p className="mt-2 text-slate-600">
          Update your survey questions and settings.
        </p>
      </div>

      <SurveyForm mode="edit" initialData={serializedSurvey} />
    </main>
  );
}
