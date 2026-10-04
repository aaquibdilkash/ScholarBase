import type { Metadata } from "next";
import ResearchToolForm from "@/components/research-tools/ResearchToolForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES, CREATE_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.researchTools.title,
  description: SEO_CREATE_PAGES.researchTools.description,
  robots: { index: true, follow: true },
};

export default function NewResearchToolPage() {
  return (
    <CreateOrEditPageShell
      title={CREATE_PAGE_TEXT.researchTools.title}
      description={CREATE_PAGE_TEXT.researchTools.description}
      backHref="/research-tools"
      backLabel="Back to Research Tools"
    >
      <ResearchToolForm mode="create" />
    </CreateOrEditPageShell>
  );
}
