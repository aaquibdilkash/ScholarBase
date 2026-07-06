import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { createArticle } from "@/app/actions/blog";
import { BrandMark } from "@/components/BrandMark";
import { ArticleComposer } from "@/components/blog/ArticleComposer";

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
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Write an Article
        </h1>
        <p className="mt-2 text-slate-600">
          Share your research, insights, and experiences with the{" "}
          <BrandMark className="font-semibold" /> community.
        </p>
      </div>

      <div className="sb-surface-strong p-8 md:p-10">
        <ArticleComposer action={createArticle} />
      </div>
    </main>
  );
}
