import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata("Edit Result - ScholarBase");
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import ResultForm from "@/components/results/ResultForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export default async function EditResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this result.",
  );

  // Fetch only the raw field data required to populate the form inputs
  const result = await prisma.result.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      type: true,
      category: true,
      conductingBody: true,
      session: true,
      description: true,
      notificationLink: true,
      resultLink: true,
      authorId: true,
    },
  });

  if (!result) {
    notFound();
  }

  // Security Guard: Ensure the current user owns this result
  if (result.authorId !== user.id) {
    throw new Error("You are not authorized to edit this result.");
  }

  return (
    <CreateOrEditPageShell
      title="Edit Result Information"
      description="Update the result details, links, or description."
      backHref={`/results/${result.id}`}
      backLabel="← Cancel and Back to Result"
    >
      <ResultForm
        mode="edit"
        resultId={result.id}
        initialValues={{
          title: result.title,
          type: result.type,
          category: result.category ?? "",
          conductingBody: result.conductingBody ?? "",
          session: result.session ?? "",
          description: result.description,
          notificationLink: result.notificationLink ?? "",
          resultLink: result.resultLink ?? "",
        }}
      />
    </CreateOrEditPageShell>
  );
}
