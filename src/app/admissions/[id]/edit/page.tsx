import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth";
import AdmissionForm from "@/app/admissions/components/AdmissionForm";

export default async function EditAdmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser("You must be logged in to edit this post.");

  // Fetch only the raw field data required to populate the form inputs
  const admission = await prisma.phdAdmission.findUnique({
    where: { id },
    select: {
      id: true,
      university: true,
      department: true,
      deadline: true,
      description: true,
      notificationLink: true,
      applyLink: true,
      authorId: true,
    },
  });

  if (!admission) {
    notFound();
  }

  // Security Guard: Ensure the current user owns this record
  if (admission.authorId !== user.id) {
    throw new Error("You are not authorized to edit this notification.");
  }

  return (
    <main className="mx-auto max-w-4xl py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={`/admissions/${admission.id}`}
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Cancel and Back to Detail
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Edit PhD Admission Notification
        </h1>
        <p className="mt-2 text-slate-600">
          Update the admission criteria, deadlines, or seat matrix requirements.
        </p>
      </div>

      <AdmissionForm
        mode="edit"
        admissionId={admission.id}
        initialValues={{
          university: admission.university,
          department: admission.department,
          deadline: new Date(admission.deadline).toISOString().slice(0, 10),
          description: admission.description,
          notificationLink: admission.notificationLink ?? "",
          applyLink: admission.applyLink ?? "",
        }}
      />
    </main>
  );
}