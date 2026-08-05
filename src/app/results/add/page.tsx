import type { Metadata } from "next";
import ResultForm from "@/components/results/ResultForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export const metadata: Metadata = {
  title: "Add Result Information",
  description:
    "Share exam results, admission outcomes, vacancy results, and other important notifications for the research community.",
  robots: { index: false, follow: true },
};

export default function NewResultPage() {
  return (
    <CreateOrEditPageShell
      title="Add Result Information"
      description="Share exam results, admission outcomes, vacancy results, and other important notifications for the research community."
      backHref="/results"
      backLabel="← Back to Results"
    >
      <ResultForm mode="create" />
    </CreateOrEditPageShell>
  );
}
