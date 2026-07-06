"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { RichContent } from "@/components/content/RichContent";

const Editor = dynamic(() => import("@/components/blog/Editor"), {
  ssr: false,
  loading: () => <p>Loading editor...</p>,
});

type ArticleComposerProps = {
  action: (formData: FormData) => void | Promise<void>;
};

export function ArticleComposer({ action }: ArticleComposerProps) {
  const [title, setTitle] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");

  const previewContent = useMemo(
    () => content || "<p>Start writing to see the live article preview.</p>",
    [content],
  );

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-8">
      <form action={action} className="flex flex-col gap-6">
        <div>
          <label className="sb-label">Article Title</label>
          <input
            name="title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="e.g., The Ultimate PhD Survival Guide"
            className="sb-input"
            required
          />
        </div>

        <div>
          <label className="sb-label">Short Description</label>
          <input
            name="excerpt"
            value={excerpt}
            onChange={(event) => setExcerpt(event.target.value)}
            placeholder="A brief summary of your article..."
            className="sb-input"
            required
          />
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between gap-3">
            <label className="sb-label mb-0">Content</label>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              CKEditor
            </span>
          </div>

          <input type="hidden" name="content" value={content} />

          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            <Editor
              value={content}
              onChange={setContent}
            />
          </div>

          <p className="mt-2 text-xs text-slate-500">
            This is a CKEditor writing surface with a live preview. It stays
            fast while giving you document-style formatting.
          </p>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <button type="submit" className="sb-button-accent">
            Publish Article
          </button>
        </div>
      </form>

      <section className="sb-surface-strong overflow-hidden border border-slate-200/70">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Live Preview
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {title || "Your article"}
            </h2>
          </div>
          <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            Draft
          </div>
        </div>

        <div className="space-y-5 p-6">
          <p className="text-sm leading-relaxed text-slate-600">
            {excerpt || "Your short description will appear here."}
          </p>

          <div className="prose prose-slate max-w-none prose-headings:text-slate-950 prose-a:text-blue-700 hover:prose-a:text-blue-600">
            <RichContent content={previewContent} />
          </div>
        </div>
      </section>
    </div>
  );
}
