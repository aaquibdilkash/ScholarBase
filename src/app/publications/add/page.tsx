import type { Metadata } from "next";
import PublicationForm from "@/components/publications/PublicationForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.publications.title,
  description: SEO_CREATE_PAGES.publications.description,
  robots: { index: true, follow: true },
};

export default function NewPublicationPage() {
  return (
    <CreateOrEditPageShell
      title={SEO_CREATE_PAGES.publications.title}
      description={SEO_CREATE_PAGES.publications.description}
      backHref="/publications"
      backLabel="Back to Publications"
    >
      <PublicationForm mode="create" />
    </CreateOrEditPageShell>
  );
}
