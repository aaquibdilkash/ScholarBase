import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import ResultForm from "@/components/results/ResultForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { EDIT_PAGE_TEXT } from "@/constants/seo";
import { resultHref } from "@/lib/results/routes";

export const metadata: Metadata = buildNoindexMetadata(
  "Edit Exams & Results Post - ScholarBase",
);

export default async function EditExamOrResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this exam or result.",
  );

  // Fetch only the raw field data required to populate the form inputs
  const result = await prisma.examsAndResults.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      kind: true,
      type: true,
      category: true,
      conductingBody: true,
      session: true,
      deadline: true,
      description: true,
      notificationLink: true,
      checkOrApplyLink: true,
      authorId: true,
    },
  });

  if (!result) {
    notFound();
  }

  // Security Guard: Ensure the current user owns this result
  if (result.authorId !== user.id) {
    throw new Error("You are not authorized to edit this exam or result.");
  }

  return (
    <CreateOrEditPageShell
      title={EDIT_PAGE_TEXT.examsAndResults.title}
      description={EDIT_PAGE_TEXT.examsAndResults.description}
      backHref={resultHref(result.id)}
      backLabel="Cancel and Back to Exam or Result"
    >
      <ResultForm
        mode="edit"
        resultId={result.id}
        initialValues={{
          title: result.title,
          kind: result.kind,
          type: result.type,
          category: result.category ?? "",
          conductingBody: result.conductingBody ?? "",
          session: result.session ?? "",
          deadline: result.deadline
            ? result.deadline.toISOString().slice(0, 10)
            : "",
          description: result.description,
          notificationLink: result.notificationLink ?? "",
          checkOrApplyLink: result.checkOrApplyLink ?? "",
        }}
      />
    </CreateOrEditPageShell>
  );
}
