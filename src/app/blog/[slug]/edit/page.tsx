import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import { requireCurrentUser } from "@/lib/auth";
import { ArticleComposer } from "@/components/blog/ArticleComposer";
import CreateOrEditPageShell from "@/components/layout/CreateOrEditPageShell";

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
      authorId: true,
      slug: true,
    },
  });

  if (!article || article.authorId !== user.id) {
    notFound();
  }

  return (
    <CreateOrEditPageShell
      title="Edit Article"
      backHref={`/blog/${article.slug}`}
      backLabel="← Cancel and Back to Article"
      maxWidth="lg"
    >
      {/* Reusing the same composer with mode="edit" */}
      <ArticleComposer
        mode="edit"
        articleId={article.id}
        slug={article.slug}
        initialValues={{
          title: article.title,
          content: article.content,
          excerpt: article.excerpt ?? "",
        }}
      />
    </CreateOrEditPageShell>
  );
}
