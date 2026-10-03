import type { Metadata } from "next";
import SupervisorForm from "@/components/supervisor/SupervisorForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.supervisor.title,
  description: SEO_CREATE_PAGES.supervisor.description,
  robots: { index: true, follow: true },
};

export default function NewSupervisorPage() {
  return (
    <CreateOrEditPageShell
      title={SEO_CREATE_PAGES.supervisor.title}
      description={SEO_CREATE_PAGES.supervisor.description}
      backHref="/supervisor"
      backLabel="Back to Supervisors"
    >
      <SupervisorForm mode="create" />
    </CreateOrEditPageShell>
  );
}
