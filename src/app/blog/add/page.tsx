import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { ArticleComposer } from "@/components/blog/ArticleComposer";
import Link from "next/link";

export default async function NewArticlePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 🛡️ The Route Guard: Redirect if not logged in
  if (!user) {
    const message = encodeURIComponent(
      "Please log in to write and publish an article.",
    );
    redirect(`/login?message=${message}`);
  }

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
          Write an Article
        </h1>
        <p className="mt-2 text-slate-600">
          Share your research, insights, and experiences with the{" "}
          <BrandMark className="font-semibold" /> community.
        </p>
      </div>

      <div className="sb-surface-strong p-8 md:p-10">
        <ArticleComposer />
      </div>
    </main>
  );
}
