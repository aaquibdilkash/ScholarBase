import prisma from "@/lib/db";
import { notFound } from "next/navigation";
import Link from "next/link";
import { requireCurrentUser } from "@/lib/auth";
import { updateArticle } from "@/app/actions/blog";
import { ArticleComposer } from "@/components/blog/ArticleComposer";

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

  async function handleUpdate(formData: FormData) {
    "use server";
    await updateArticle(formData, article!.id, article!.slug);
  }

  return (
    <main className="mx-auto max-w-5xl py-6 px-4">
      <div className="mb-8">
        <Link
          href={`/blog/${article.slug}`}
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Cancel and Back to Article
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Edit Article
        </h1>
      </div>

      {/* Reusing the same composer with mode="edit" */}
      <ArticleComposer
        mode="edit"
        action={handleUpdate}
        initialValues={{
          title: article.title,
          content: article.content,
          excerpt: article.excerpt ?? "",
        }}
      />
    </main>
  );
}
