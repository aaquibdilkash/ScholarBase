import type { Metadata } from "next";
import ResearchToolForm from "@/components/research-tools/ResearchToolForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export const metadata: Metadata = {
  title: "Add Research Tool",
  description: "Add a research tool or software to help fellow researchers.",
  robots: { index: false, follow: true },
};

export default function NewResearchToolPage() {
  return (
    <CreateOrEditPageShell
      title="Add Research Tool"
      description="Add a research tool or software to help fellow researchers."
      backHref="/research-tools"
      backLabel="← Back to Research Tools"
    >
      <ResearchToolForm mode="create" />
    </CreateOrEditPageShell>
  );
}
