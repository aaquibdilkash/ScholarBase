import { createClient } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { createArticle } from "../actions";

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
    <main className="max-w-3xl mx-auto py-10 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">
          Write an Article
        </h1>
        <p className="text-slate-500 mt-2">
          Share your research, insights, and experiences with the ScholarBase
          community.
        </p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 p-8 md:p-10">
        <form action={createArticle} className="flex flex-col gap-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Article Title
            </label>
            <input
              name="title"
              placeholder="e.g., The Ultimate PhD Survival Guide"
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Short Description
            </label>
            <input
              name="excerpt"
              placeholder="A brief summary of your article..."
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Content (Markdown Supported)
            </label>
            <textarea
              name="content"
              placeholder="Write your article here..."
              className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:bg-white outline-none transition-all text-slate-900 placeholder:text-slate-400 h-80 resize-y"
              required
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 text-white px-8 py-3 rounded-xl font-bold shadow-sm shadow-blue-600/20 hover:bg-blue-700 hover:shadow-md hover:shadow-blue-600/30 transition-all duration-200"
            >
              Publish Article
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
