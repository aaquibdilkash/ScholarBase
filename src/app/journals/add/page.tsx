import type { Metadata } from "next";
import JournalForm from "@/components/journals/JournalForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES, CREATE_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.journals.title,
  description: SEO_CREATE_PAGES.journals.description,
  robots: { index: true, follow: true },
};

export default function NewJournalPage() {
  return (
    <CreateOrEditPageShell
      title={CREATE_PAGE_TEXT.journals.title}
      description={CREATE_PAGE_TEXT.journals.description}
      backHref="/journals"
      backLabel="Back to Journals"
    >
      <JournalForm mode="create" />
    </CreateOrEditPageShell>
  );
}
