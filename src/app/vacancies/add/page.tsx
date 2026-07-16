import Link from "next/link";
import VacancyForm from "@/app/vacancies/components/VacancyForm";

export default function NewVacancyPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href="/vacancies"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Vacancies
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Post an Academic Vacancy
        </h1>
        <p className="mt-2 text-slate-600">
          Share trustworthy openings for the academic community.
        </p>
      </div>

      <VacancyForm mode="create" />
    </main>
  );
}
