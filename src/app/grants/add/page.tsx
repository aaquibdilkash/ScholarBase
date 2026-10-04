import type { Metadata } from "next";
import ResearchGrantForm from "@/components/grants/ResearchGrantForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES, CREATE_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.grants.title,
  description: SEO_CREATE_PAGES.grants.description,
  robots: { index: true, follow: true },
};

export default function NewResearchGrantPage() {
  return (
    <CreateOrEditPageShell
      title={CREATE_PAGE_TEXT.grants.title}
      description={CREATE_PAGE_TEXT.grants.description}
      backHref="/grants"
      backLabel="Back to Research Grants"
    >
      <ResearchGrantForm mode="create" />
    </CreateOrEditPageShell>
  );
}
