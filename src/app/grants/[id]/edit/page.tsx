import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata(
  "Edit Grant - ScholarBase",
);
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import ResearchGrantForm from "@/components/grants/ResearchGrantForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { EDIT_PAGE_TEXT } from "@/constants/seo";

export default async function EditResearchGrantPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this grant.",
  );

  const grant = await prisma.researchGrant.findUnique({
    where: { id },
    select: {
      id: true,
      title: true,
      amount: true,
      description: true,
      applyLink: true,
      infoLink: true,
      authorId: true,
    },
  });

  if (!grant) notFound();
  if (grant.authorId !== user.id)
    throw new Error("You are not authorized to edit this research grant.");

  return (
    <CreateOrEditPageShell
      title={EDIT_PAGE_TEXT.grants.title}
      description={EDIT_PAGE_TEXT.grants.description}
      backHref={`/grants/${grant.id}`}
      backLabel="Cancel and Back to Research Grant"
    >
      <ResearchGrantForm
        mode="edit"
        grantId={grant.id}
        initialValues={{
          title: grant.title,
          amount: grant.amount ?? "",
          description: grant.description,
          applyLink: grant.applyLink ?? "",
          infoLink: grant.infoLink ?? "",
        }}
      />
    </CreateOrEditPageShell>
  );
}
