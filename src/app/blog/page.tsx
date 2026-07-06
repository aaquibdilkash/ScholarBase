import prisma from "@/lib/db";
import Link from "next/link";

export default async function BlogIndex() {
  const articles = await prisma.article.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-6xl py-6">
      <div className="mb-8 flex items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
            Research Blog
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Essays, notes, and longer-form research reflections.
          </p>
        </div>
        <Link href="/blog/new" className="sb-button-accent whitespace-nowrap">
          + New Article
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/blog/${article.slug}`}
            className="sb-card sb-card-hover group flex flex-col"
          >
            <h2 className="mb-2 text-xl font-semibold leading-tight text-slate-950 group-hover:text-blue-700 transition-colors">
              {article.title}
            </h2>
            <p className="flex-grow text-sm leading-relaxed text-slate-600 line-clamp-3">
              {article.excerpt}
            </p>
            <div className="mt-6 flex items-center border-t border-slate-100 pt-4 text-sm font-semibold text-blue-700">
              Read Article{" "}
              <span className="ml-1 group-hover:translate-x-1 transition-transform">
                →
              </span>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}
