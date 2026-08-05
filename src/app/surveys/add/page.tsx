import type { Metadata } from "next";
import SurveyForm from "@/components/surveys/SurveyForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export const metadata: Metadata = {
  title: "Create Survey",
  description:
    "Create a new survey to collect responses from the academic community.",
  robots: { index: false, follow: true },
};

export default function NewSurveyPage() {
  return (
    <CreateOrEditPageShell
      title="Create Survey"
      description="Create a new survey to collect responses from the academic community."
      backHref="/surveys"
      backLabel="← Back to Surveys"
    >
      <SurveyForm mode="create" />
    </CreateOrEditPageShell>
  );
}
