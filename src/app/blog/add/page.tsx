import type { Metadata } from "next";
import Link from "next/link";
import ArticleForm from "@/components/blog/ArticleForm";

export const metadata: Metadata = {
  title: "Write New Article",
  description: "Write and publish a new article on ScholarBase blog.",
  robots: { index: false, follow: true },
};

export default function NewBlogPage() {
  return (
    <main className="mx-auto max-w-4xl py-6">
      <div className="mb-8">
        <Link
          href="/blog"
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Back to Blog
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Write New Article
        </h1>
        <p className="mt-2 text-slate-600">
          Write and publish a new article on ScholarBase blog.
        </p>
      </div>

      <ArticleForm mode="create" slug={undefined} />
    </main>
  );
}