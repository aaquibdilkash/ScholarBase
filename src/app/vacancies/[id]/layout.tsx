import type { Metadata } from "next";
import { getVacancyById } from "@/app/actions/vacancies";
import { buildMetadata } from "@/lib/seo";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const vacancy = await getVacancyById(id).catch(() => null);
  if (!vacancy) return { title: "Academic Vacancy" };
  return buildMetadata({
    title: vacancy.title,
    description: `${vacancy.title} at ${vacancy.institution}.`,
    path: `/vacancies/${vacancy.id}`,
    type: "article",
  });
}

export default function VacancyDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}