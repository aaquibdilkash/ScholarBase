import type { Metadata } from "next";
import { ArticleComposer } from "@/components/blog/ArticleComposer";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

export const metadata: Metadata = {
  title: "Write New Article",
  description: "Write and publish a new article on ScholarBase blog.",
  robots: { index: false, follow: true },
};

export default function NewBlogPage() {
  return (
    <CreateOrEditPageShell
      title="Write New Article"
      description="Write and publish a new article on ScholarBase blog."
      backHref="/blog"
      backLabel="← Back to Blog"
      maxWidth="lg"
    >
      <ArticleComposer mode="create" slug={undefined} />
    </CreateOrEditPageShell>
  );
}
