import type { Metadata } from "next";
import SupervisorForm from "@/components/supervisor/SupervisorForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export const metadata: Metadata = {
  title: "Add Supervisor",
  description: "Add a PhD supervisor or mentor to help fellow researchers.",
  robots: { index: false, follow: true },
};

export default function NewSupervisorPage() {
  return (
    <CreateOrEditPageShell
      title="Add Supervisor"
      description="Add a PhD supervisor or mentor to help fellow researchers."
      backHref="/supervisor"
      backLabel="← Back to Supervisors"
    >
      <SupervisorForm mode="create" />
    </CreateOrEditPageShell>
  );
}
