import type { Metadata } from "next";
import VacancyForm from "@/components/vacancies/VacancyForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.vacancies.title,
  description: SEO_CREATE_PAGES.vacancies.description,
  robots: { index: true, follow: true },
};

export default function NewVacancyPage() {
  return (
    <CreateOrEditPageShell
      title={SEO_CREATE_PAGES.vacancies.title}
      description={SEO_CREATE_PAGES.vacancies.description}
      backHref="/vacancies"
      backLabel="Back to Vacancies"
    >
      <VacancyForm mode="create" />
    </CreateOrEditPageShell>
  );
}
