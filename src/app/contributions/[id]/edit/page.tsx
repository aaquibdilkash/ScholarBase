import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata(
  "Edit Contribution - ScholarBase",
);
import { notFound } from "next/navigation";
import { getContributionForEdit } from "@/app/actions/contributions";
import ContributionForm from "@/components/contributions/ContributionForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { EDIT_PAGE_TEXT } from "@/constants/seo";
import { ComingSoon } from "@/components/contributions/ComingSoon";
import { isComingSoon } from "@/lib/feature-flags";

export default async function EditContributionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  if (isComingSoon) {
    return <ComingSoon />;
  }

  const { id } = await params;
  const contribution = await getContributionForEdit(id);

  if (!contribution) {
    notFound();
  }

  return (
    <CreateOrEditPageShell
      title={EDIT_PAGE_TEXT.contributions.title}
      description={EDIT_PAGE_TEXT.contributions.description}
      backHref={`/contributions/${contribution.id}`}
      backLabel="Cancel and Back to Contribution"
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
