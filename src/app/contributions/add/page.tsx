import type { Metadata } from "next";
import ContributionForm from "@/components/contributions/ContributionForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES, CREATE_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.contributions.title,
  description: SEO_CREATE_PAGES.contributions.description,
  robots: { index: true, follow: true },
};

export default function NewContributionPage() {
  return (
    <CreateOrEditPageShell
      title={CREATE_PAGE_TEXT.contributions.title}
      description={CREATE_PAGE_TEXT.contributions.description}
      backHref="/contributions"
      backLabel="Back to Contributions"
    >
      <ContributionForm mode="create" />
    </CreateOrEditPageShell>
  );
}
