import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import ResearchToolForm from "@/components/research-tools/ResearchToolForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

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
    <CreateOrEditPageShell
      title="Edit Research Tool"
      description="Update the description, use case, or website link for this tool."
      backHref={`/research-tools/${tool.id}`}
      backLabel="← Cancel and Back to Research Tool"
    >
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
    </CreateOrEditPageShell>
  );
}
