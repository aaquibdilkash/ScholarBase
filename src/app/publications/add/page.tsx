import type { Metadata } from "next";
import PublicationForm from "@/components/publications/PublicationForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES, CREATE_PAGE_TEXT } from "@/constants/seo";
import { requireCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.publications.title,
  description: SEO_CREATE_PAGES.publications.description,
  robots: { index: true, follow: true },
};

export default async function NewPublicationPage() {
  const user = await requireCurrentUser("You must be logged in to add a publication.");

  return (
    <CreateOrEditPageShell
      title={CREATE_PAGE_TEXT.publications.title}
      description={CREATE_PAGE_TEXT.publications.description}
      backHref={`/scholars/${user.id}?tab=about`}
      backLabel="Back to Scholar Profile"
    >
      <PublicationForm mode="create" />
    </CreateOrEditPageShell>
  );
}
