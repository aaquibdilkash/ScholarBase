import type { Metadata } from "next";
import ResultForm from "@/components/results/ResultForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES, CREATE_PAGE_TEXT } from "@/constants/seo";
import { RESULTS_BASE_PATH } from "@/lib/results/routes";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.examsAndResults.title,
  description: SEO_CREATE_PAGES.examsAndResults.description,
  robots: { index: true, follow: true },
};

export default function NewExamOrResultPage() {
  return (
    <CreateOrEditPageShell
      title={CREATE_PAGE_TEXT.examsAndResults.title}
      description={CREATE_PAGE_TEXT.examsAndResults.description}
      backHref={RESULTS_BASE_PATH}
      backLabel="Back to Exams & Results"
    >
      <ResultForm mode="create" />
    </CreateOrEditPageShell>
  );
}
