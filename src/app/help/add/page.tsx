import type { Metadata } from "next";
import HelpPostForm from "@/components/help/HelpPostForm";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.help.title,
  description: SEO_CREATE_PAGES.help.description,
  robots: { index: true, follow: true },
};

export default function NewHelpPage() {
  return (
    <CreateOrEditPageShell
      title={SEO_CREATE_PAGES.help.title}
      description={SEO_CREATE_PAGES.help.description}
      backHref="/help"
      backLabel="Back to Help"
    >
      <HelpPostForm mode="create" />
    </CreateOrEditPageShell>
  );
}
