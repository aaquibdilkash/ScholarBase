import type { Metadata } from "next";
import AdmissionForm from "@/components/admissions/AdmissionForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.admissions.title,
  description: SEO_CREATE_PAGES.admissions.description,
  robots: { index: true, follow: true },
};

export default function NewAdmissionPage() {
  return (
    <CreateOrEditPageShell
      title={SEO_CREATE_PAGES.admissions.title}
      description={SEO_CREATE_PAGES.admissions.description}
      backHref="/admissions"
      backLabel="Back to Admissions"
    >
      <AdmissionForm mode="create" />
    </CreateOrEditPageShell>
  );
}
