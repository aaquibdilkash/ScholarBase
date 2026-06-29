import prisma from "@/lib/db";
import Link from "next/link";

export default async function BlogIndex() {
  const articles = await prisma.article.findMany({
    orderBy: { createdAt: "desc" },
  });

  return (
    <main className="max-w-5xl mx-auto py-8 px-4">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Research Blog
        </h1>
        <Link
          href="/blog/new"
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-semibold shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/30 transition-all duration-200 whitespace-nowrap"
        >
          + New Article
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {articles.map((article) => (
          <Link
            key={article.id}
            href={`/blog/${article.slug}`}
            className="group border border-slate-200/60 rounded-2xl p-6 bg-white shadow-sm hover:shadow-[0_8px_30px_rgb(0,0,0,0.06)] hover:-translate-y-1 hover:border-blue-100 transition-all duration-300 flex flex-col"
          >
            <h2 className="text-xl font-bold text-slate-900 mb-2 group-hover:text-blue-600 transition-colors leading-tight">
              {article.title}
            </h2>
            <p className="text-sm text-slate-500 line-clamp-3 leading-relaxed flex-grow">
              {article.excerpt}
            </p>
            <div className="mt-6 pt-4 border-t border-slate-50 flex items-center text-sm font-semibold text-blue-600">
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
