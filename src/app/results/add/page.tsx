import type { Metadata } from "next";
import ResultForm from "@/components/results/ResultForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES, CREATE_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.results.title,
  description: SEO_CREATE_PAGES.results.description,
  robots: { index: true, follow: true },
};

export default function NewResultPage() {
  return (
    <CreateOrEditPageShell
      title={CREATE_PAGE_TEXT.results.title}
      description={CREATE_PAGE_TEXT.results.description}
      backHref="/results"
      backLabel="Back to Results"
    >
      <ResultForm mode="create" />
    </CreateOrEditPageShell>
  );
}
