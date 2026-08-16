import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata("Edit Supervisor - ScholarBase");
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import SupervisorForm from "@/components/supervisor/SupervisorForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export default async function EditSupervisorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supervisor = await prisma.supervisor.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      university: true,
      department: true,
      about: true,
    },
  });

  if (!supervisor) {
    notFound();
  }

  return (
    <CreateOrEditPageShell
      title="Edit Supervisor"
      description={`Update the profile details for ${supervisor.name}.`}
      backHref={`/supervisor/${supervisor.id}`}
      backLabel="← Cancel and Back to Supervisor"
    >
      <SupervisorForm
        mode="edit"
        supervisorId={supervisor.id}
        initialValues={{
          name: supervisor.name,
          university: supervisor.university,
          department: supervisor.department ?? "",
          about: supervisor.about ?? "",
        }}
      />
    </CreateOrEditPageShell>
  );
}
