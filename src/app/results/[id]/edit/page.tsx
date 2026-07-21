import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth";
import ResultForm from "@/components/results/ResultForm";

export default async function EditResultPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser("You must be logged in to edit this result.");

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
    <main className="mx-auto max-w-4xl py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={`/results/${result.id}`}
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Cancel and Back to Result
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Edit Result Information
        </h1>
        <p className="mt-2 text-slate-600">
          Update the result details, links, or description.
        </p>
      </div>

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
    </main>
  );
}

