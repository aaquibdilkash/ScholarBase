import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth";
import ResearchToolForm from "@/app/research-tools/components/ResearchToolForm";

export default async function EditResearchToolPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this tool.",
  );

  // Fetch only the raw field data required to populate the form inputs
  const tool = await prisma.researchTool.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      website: true,
      use: true,
      description: true,
      authorId: true,
    },
  });

  if (!tool) {
    notFound();
  }

  // Security Guard: Ensure the current user owns this tool
  if (tool.authorId !== user.id) {
    throw new Error("You are not authorized to edit this research tool.");
  }

  return (
    <main className="mx-auto max-w-4xl py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={`/research-tools/${tool.id}`}
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Cancel and Back to Research Tool
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Edit Research Tool
        </h1>
        <p className="mt-2 text-slate-600">
          Update the description, use case, or website link for this tool.
        </p>
      </div>

      <ResearchToolForm
        mode="edit"
        toolId={tool.id}
        initialValues={{
          name: tool.name,
          website: tool.website ?? "",
          use: tool.use,
          description: tool.description,
        }}
      />
    </main>
  );
}
