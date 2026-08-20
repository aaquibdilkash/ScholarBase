import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata("Edit Survey - ScholarBase");
import { notFound } from "next/navigation";
import SurveyForm from "@/components/surveys/SurveyForm";
import { createClient } from "@/utils/supabase/server";
import { getSurvey } from "@/app/actions/surveys";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

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
    totalVotes: survey.totalVotes ?? 0,
    totalComments: survey.totalComments ?? 0,
    totalResponses: survey.totalResponses ?? 0,
  };

  return (
    <CreateOrEditPageShell
      title="Edit Research Survey"
      description="Update your survey questions and settings."
      backHref={`/surveys/${id}`}
      backLabel="← Back to Survey"
    >
      <SurveyForm mode="edit" initialData={serializedSurvey} />
    </CreateOrEditPageShell>
  );
}
