import type { Metadata } from "next";
import VacancyForm from "@/components/vacancies/VacancyForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export const metadata: Metadata = {
  title: "Post an Academic Vacancy",
  description:
    "Share trustworthy academic job openings, postdoctoral positions, and research opportunities with the community.",
  robots: { index: false, follow: true },
};

export default function NewVacancyPage() {
  return (
    <CreateOrEditPageShell
      title="Post an Academic Vacancy"
      description="Share trustworthy openings for the academic community."
      backHref="/vacancies"
      backLabel="← Back to Vacancies"
    >
      <VacancyForm mode="create" />
    </CreateOrEditPageShell>
  );
}
