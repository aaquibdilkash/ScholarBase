import type { Metadata } from "next";
import HelpPostForm from "@/components/help/HelpPostForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export const metadata: Metadata = {
  title: "Post Help / Feedback",
  description:
    "Report bugs, request features, or provide feedback to improve ScholarBase.",
  robots: { index: false, follow: true },
};

export default function NewHelpPage() {
  return (
    <CreateOrEditPageShell
      title="Post Help / Feedback"
      description="Report bugs, request features, or provide feedback to improve ScholarBase."
      backHref="/help"
      backLabel="← Back to Help"
    >
      <HelpPostForm mode="create" />
    </CreateOrEditPageShell>
  );
}
