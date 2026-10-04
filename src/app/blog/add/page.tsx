import type { Metadata } from "next";
import { ArticleComposer } from "@/components/blog/ArticleComposer";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { SEO_CREATE_PAGES, CREATE_PAGE_TEXT } from "@/constants/seo";

export const metadata: Metadata = {
  title: SEO_CREATE_PAGES.blog.title,
  description: SEO_CREATE_PAGES.blog.description,
  robots: { index: true, follow: true },
};

export default function NewBlogPage() {
  return (
    <CreateOrEditPageShell
      title={CREATE_PAGE_TEXT.blog.title}
      description={CREATE_PAGE_TEXT.blog.description}
      backHref="/blog"
      backLabel="Back to Blog"
      maxWidth="lg"
    >
      <ArticleComposer mode="create" slug={undefined} />
    </CreateOrEditPageShell>
  );
}
