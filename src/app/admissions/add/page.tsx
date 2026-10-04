import type { Metadata } from "next";
import AdmissionForm from "@/components/admissions/AdmissionForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES, CREATE_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.admissions.title,
  description: SEO_CREATE_PAGES.admissions.description,
  robots: { index: true, follow: true },
};

export default function NewAdmissionPage() {
  return (
    <CreateOrEditPageShell
      title={CREATE_PAGE_TEXT.admissions.title}
      description={CREATE_PAGE_TEXT.admissions.description}
      backHref="/admissions"
      backLabel="Back to Admissions"
    >
      <AdmissionForm mode="create" />
    </CreateOrEditPageShell>
  );
}
