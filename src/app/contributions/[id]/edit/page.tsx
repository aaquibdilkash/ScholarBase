import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import { getContributionForEdit } from "@/app/actions/contributions";
import ContributionForm from "@/components/contributions/ContributionForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export default async function EditContributionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this contribution.",
  );

  const contribution = await getContributionForEdit(id, user.id);

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
