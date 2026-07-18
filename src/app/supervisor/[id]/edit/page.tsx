import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import SupervisorForm from "@/components/supervisor/SupervisorForm";

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
    <main className="mx-auto max-w-4xl py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={`/supervisor/${supervisor.id}`}
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Cancel and Back to Supervisor
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Edit Supervisor
        </h1>
        <p className="mt-2 text-slate-600">
          Update the profile details for {supervisor.name}.
        </p>
      </div>

      <div className="sb-surface-strong p-8 md:p-10">
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
      </div>
    </main>
  );
}
