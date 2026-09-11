import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata("Edit Contribution - ScholarBase");
import { notFound } from "next/navigation";
import { getContributionForEdit } from "@/app/actions/contributions";
import ContributionForm from "@/components/contributions/ContributionForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export default async function EditContributionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const contribution = await getContributionForEdit(id);

  if (!contribution) {
    notFound();
  }

  return (
    <CreateOrEditPageShell
      title="Edit Contribution"
      description="Update your contribution details."
      backHref={`/contributions/${contribution.id}`}
      backLabel="← Cancel and Back to Contribution"
    >
      <ContributionForm
        mode="edit"
        contributionId={contribution.id}
        contributionStatus={contribution.status}
        initialValues={{
          title: contribution.title,
          message: contribution.message,
          amount: contribution.amount?.toString() ?? "",
          upiId: contribution.upiId ?? "",
          paymentMethod: contribution.paymentMethod ?? "",
          screenshotUrl: contribution.screenshotUrl ?? "",
        }}
      />
    </CreateOrEditPageShell>
  );
}
