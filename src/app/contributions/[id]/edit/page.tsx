import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth";
import { getContributionForEdit } from "@/app/actions/contributions";
import ContributionForm from "@/components/contributions/ContributionForm";

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
    <main className="mx-auto max-w-4xl py-6 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={`/contributions/${contribution.id}`}
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Cancel and Back to Contribution
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Edit Contribution
        </h1>
        <p className="mt-2 text-slate-600">Update your contribution details.</p>
      </div>

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
    </main>
  );
}
