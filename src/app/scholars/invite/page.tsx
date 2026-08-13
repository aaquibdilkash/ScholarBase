import type { Metadata } from "next";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { InviteScholarForm } from "@/components/scholars/InviteScholarForm";

export const metadata: Metadata = {
  title: "Invite Scholar",
  description:
    "Invite a scholar to join ScholarBase and collaborate on research.",
  robots: { index: false, follow: true },
};

export default function InviteScholarPage() {
  return (
    <CreateOrEditPageShell
      title="Invite Scholar"
      description="Send a collaboration invite to a scholar who is not on ScholarBase yet."
      backHref="/scholars"
      backLabel="← Back to Scholars"
      maxWidth="sm"
    >
      <InviteScholarForm />
    </CreateOrEditPageShell>
  );
}
