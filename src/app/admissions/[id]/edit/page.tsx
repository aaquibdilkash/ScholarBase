import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import AdmissionForm from "@/components/admissions/AdmissionForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export default async function EditAdmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this post.",
  );

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
    <CreateOrEditPageShell
      title="Edit PhD Admission Notification"
      description="Update the admission criteria, deadlines, or seat matrix requirements."
      backHref={`/admissions/${admission.id}`}
      backLabel="← Cancel and Back to Detail"
    >
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
    </CreateOrEditPageShell>
  );
}
