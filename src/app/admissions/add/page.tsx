import type { Metadata } from "next";
import AdmissionForm from "@/components/admissions/AdmissionForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export const metadata: Metadata = {
  title: "Post PhD Admission Notification",
  description:
    "Share PhD admissions, call for applications, and academic intake notifications with researchers.",
  robots: { index: false, follow: true },
};

export default function NewAdmissionPage() {
  return (
    <CreateOrEditPageShell
      title="Post PhD Admission Notification"
      description="Share PhD admissions, call for applications, and academic intake notifications."
      backHref="/admissions"
      backLabel="← Back to Admissions"
    >
      <AdmissionForm mode="create" />
    </CreateOrEditPageShell>
  );
}
