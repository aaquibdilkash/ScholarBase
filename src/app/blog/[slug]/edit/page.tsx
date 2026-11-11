import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata(
  "Edit Article - ScholarBase",
);
import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import { repairLegacyInlineImages } from "@/lib/article-content";
import { ArticleComposer } from "@/components/blog/ArticleComposer";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";
import { EDIT_PAGE_TEXT } from "@/constants/seo";

export default async function EditArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const user = await requireCurrentUser(
    "You must be logged in to edit this article.",
  );

  const article = await prisma.article.findUnique({
    where: { slug },
    select: {
      id: true,
      title: true,
      content: true,
      excerpt: true,
      imageUrl: true,
      authorId: true,
      slug: true,
    },
  });

  if (!article || article.authorId !== user.id) {
    notFound();
  }

  // Legacy rows stored inline images as escaped text; repair them so the
  // editor loads real image nodes instead of raw markup.
  const content = repairLegacyInlineImages(article.content);

  return (
    <CreateOrEditPageShell
      title={EDIT_PAGE_TEXT.blog.title}
      backHref={`/blog/${article.slug}`}
      backLabel="Cancel and Back to Article"
      maxWidth="lg"
    >
      {/* Reusing the same composer with mode="edit" */}
      <ArticleComposer
        mode="edit"
        articleId={article.id}
        slug={article.slug}
        initialValues={{
          title: article.title,
          content,
          excerpt: article.excerpt ?? "",
          imageUrl: article.imageUrl ?? "",
        }}
      />
    </CreateOrEditPageShell>
  );
}
