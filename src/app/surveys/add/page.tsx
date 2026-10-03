import type { Metadata } from "next";
import SurveyForm from "@/components/surveys/SurveyForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.surveys.title,
  description: SEO_CREATE_PAGES.surveys.description,
  robots: { index: true, follow: true },
};

export default function NewSurveyPage() {
  return (
    <CreateOrEditPageShell
      title={SEO_CREATE_PAGES.surveys.title}
      description={SEO_CREATE_PAGES.surveys.description}
      backHref="/surveys"
      backLabel="Back to Surveys"
    >
      <SurveyForm mode="create" />
    </CreateOrEditPageShell>
  );
}
