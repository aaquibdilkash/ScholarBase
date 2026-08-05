import type { Metadata } from "next";
import PublicationForm from "@/components/publications/PublicationForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export const metadata: Metadata = {
  title: "Add Publication",
  description:
    "Add your research publication, paper, or academic work to your profile.",
  robots: { index: false, follow: true },
};

export default function NewPublicationPage() {
  return (
    <CreateOrEditPageShell
      title="Add Publication"
      description="Add your research publication, paper, or academic work to your profile."
      backHref="/publications"
      backLabel="← Back to Publications"
    >
      <PublicationForm mode="create" />
    </CreateOrEditPageShell>
  );
}
