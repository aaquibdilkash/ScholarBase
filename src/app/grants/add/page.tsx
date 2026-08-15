import type { Metadata } from "next";
import ResearchGrantForm from "@/components/grants/ResearchGrantForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export const metadata: Metadata = {
  title: "Add Research Grant",
  description: "Share a research grant, funding amount, application guidance, and useful links.",
  robots: { index: false, follow: true },
};

export default function NewResearchGrantPage() {
  return (
    <CreateOrEditPageShell
      title="Add Research Grant"
      description="Share a grant opportunity and explain how scholars can apply."
      backHref="/grants"
      backLabel="← Back to Research Grants"
    >
      <ResearchGrantForm mode="create" />
    </CreateOrEditPageShell>
  );
}
