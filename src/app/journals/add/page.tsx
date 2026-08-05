import type { Metadata } from "next";
import JournalForm from "@/components/journals/JournalForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export const metadata: Metadata = {
  title: "Add Journal",
  description: "Add an academic journal with its rankings and impact factor.",
  robots: { index: false, follow: true },
};

export default function NewJournalPage() {
  return (
    <CreateOrEditPageShell
      title="Add Journal"
      description="Add an academic journal with its rankings and impact factor."
      backHref="/journals"
      backLabel="← Back to Journals"
    >
      <JournalForm mode="create" />
    </CreateOrEditPageShell>
  );
}
