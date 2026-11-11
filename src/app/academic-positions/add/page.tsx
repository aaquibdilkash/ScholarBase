import type { Metadata } from "next";
import AcademicPositionForm from "@/components/academic-positions/AcademicPositionForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES, CREATE_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.academicPositions.title,
  description: SEO_CREATE_PAGES.academicPositions.description,
  robots: { index: true, follow: true },
};

export default function NewAcademicPositionPage() {
  return (
    <CreateOrEditPageShell
      title={CREATE_PAGE_TEXT.academicPositions.title}
      description={CREATE_PAGE_TEXT.academicPositions.description}
      backHref="/academic-positions"
      backLabel="Back to Academic Positions"
    >
      <AcademicPositionForm mode="create" />
    </CreateOrEditPageShell>
  );
}
