import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/utils/supabase/server";
import { getSurveyResults, getSurveyResponses } from "@/app/actions/surveys";
import { SurveyResultsView } from "@/components/surveys/SurveyResultsView";

export default async function SurveyResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const survey = await getSurveyResults(id);
  if (!survey) notFound();

  // Fetch individual responses ONLY if the current user is the author
  const responses =
    user?.id === survey.authorId
      ? await getSurveyResponses(id, user.id)
      : null;

  // Allow access if user is author or data sharing is enabled
  const canView = survey.authorId === user?.id || survey.shareData;
  if (!canView) {
    return (
      <main className="mx-auto max-w-3xl py-12">
        <Link
          href={`/surveys/${id}`}
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Survey
        </Link>
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-8 text-center">
          <h2 className="text-lg font-semibold text-amber-800 mb-2">
            Results Not Available
          </h2>
          <p className="text-sm text-amber-600">
            The survey creator has not enabled data sharing yet. Results will be
            available once the creator enables data sharing.
          </p>
        </div>
      </main>
    );
  }

  const serializedSurvey = {
    id: survey.id,
    title: survey.title,
    _count: survey._count,
    questions: survey.questions.map((q) => ({
      id: q.id,
      title: q.title,
      type: q.type,
      order: q.order,
      minValue: q.minValue,
      maxValue: q.maxValue,
      archivedAt: q.archivedAt?.toISOString() ?? null,
      options: q.options.map((o) => ({
        id: o.id,
        value: o.value,
        label: o.label,
        order: o.order,
      })),
      answers: q.answers.map((a) => ({
        value: a.value,
      })),
    })),
  };

  return (
    <main className="mx-auto max-w-3xl py-12">
      <Link
        href={`/surveys/${id}`}
        className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
      >
        ← Back to Survey
      </Link>
      <h1 className="text-2xl font-semibold text-slate-950 mb-6">
        Survey Results
      </h1>
      <SurveyResultsView survey={serializedSurvey} responses={responses} />
    </main>
  );
}
