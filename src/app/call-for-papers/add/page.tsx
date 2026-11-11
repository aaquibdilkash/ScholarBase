import type { Metadata } from "next";
import CallForPaperForm from "@/components/call-for-papers/CallForPaperForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES, CREATE_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.callForPapers.title,
  description: SEO_CREATE_PAGES.callForPapers.description,
  robots: { index: true, follow: true },
};

export default function NewEventPage() {
  return (
    <CreateOrEditPageShell
      title={CREATE_PAGE_TEXT.callForPapers.title}
      description={CREATE_PAGE_TEXT.callForPapers.description}
      backHref="/call-for-papers"
      backLabel="Back to Call for Papers"
    >
      <CallForPaperForm mode="create" />
    </CreateOrEditPageShell>
  );
}
