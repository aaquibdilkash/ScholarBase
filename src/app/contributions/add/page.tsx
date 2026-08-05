import type { Metadata } from "next";
import ContributionForm from "@/components/contributions/ContributionForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export const metadata: Metadata = {
  title: "Make a Contribution",
  description: "Support ScholarBase development by making a contribution.",
  robots: { index: false, follow: true },
};

export default function NewContributionPage() {
  return (
    <CreateOrEditPageShell
      title="Make a Contribution"
      description="Support ScholarBase development by making a contribution."
      backHref="/contributions"
      backLabel="← Back to Contributions"
    >
      <ContributionForm mode="create" />
    </CreateOrEditPageShell>
  );
}
