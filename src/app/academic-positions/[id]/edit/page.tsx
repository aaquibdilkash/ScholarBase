import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata(
  "Edit Academic Position - ScholarBase",
);
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import AcademicPositionForm from "@/components/academic-positions/AcademicPositionForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { EDIT_PAGE_TEXT } from "@/constants/seo";
import { stripMailtoPrefix } from "@/lib/email-normalizer";

export default async function EditAcademicPositionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this position.",
  );

  const academicPosition = await prisma.academicPosition.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      institution: true,
      department: true,
      subject: true,
      positionType: true,
      salaryOrStipend: true,
      contractDuration: true,
      startDate: true,
      location: true,
      isRemote: true,
      deadline: true,
      description: true,
      imageUrl: true,
      notificationLink: true,
      applyLink: true,
      authorId: true,
    },
  });

  if (!academicPosition) {
    notFound();
  }

  // Security Guard
  if (academicPosition.authorId !== user.id) {
    throw new Error("You are not authorized to edit this position.");
  }

  return (
    <CreateOrEditPageShell
      title={EDIT_PAGE_TEXT.academicPositions.title}
      description={EDIT_PAGE_TEXT.academicPositions.description}
      backHref={`/academic-positions/${academicPosition.id}`}
      backLabel="Cancel and Back to Academic Position"
    >
      <AcademicPositionForm
        mode="edit"
        academicPositionId={academicPosition.id}
        initialValues={{
          title: academicPosition.title,
          institution: academicPosition.institution,
          department: academicPosition.department ?? "",
          subject: academicPosition.subject ?? "",
          positionType: academicPosition.positionType,
          salaryOrStipend: academicPosition.salaryOrStipend ?? "",
          contractDuration: academicPosition.contractDuration ?? "",
          startDate: academicPosition.startDate
            ? new Date(academicPosition.startDate).toISOString().slice(0, 10)
            : "",
          location: academicPosition.location ?? "",
          isRemote: academicPosition.isRemote,
          deadline: new Date(academicPosition.deadline).toISOString().slice(0, 10),
          description: academicPosition.description,
          notificationLink: academicPosition.notificationLink ?? "",
          imageUrl: academicPosition.imageUrl ?? "",
          // Legacy rows may store `mailto:a@b.com` from the old writer —
          // prefill the bare email so the user never sees/edits `mailto:` text.
          applyLink: academicPosition.applyLink ? stripMailtoPrefix(academicPosition.applyLink) : "",
        }}
      />
    </CreateOrEditPageShell>
  );
}
