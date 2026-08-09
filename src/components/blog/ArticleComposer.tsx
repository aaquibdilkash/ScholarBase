"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { RichContent } from "@/components/content/RichContent";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import { createArticle, updateArticle } from "@/app/actions/blog";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";

const Editor = dynamic(
  () => import("@/components/ui/Editor").then((m) => m.Editor),
  {
    ssr: false,
    loading: () => <p>Loading editor...</p>,
  },
);

type ArticleComposerProps = {
  mode?: "create" | "edit";
  articleId?: string;
  slug?: string;
  initialValues?: { title: string; excerpt: string; content: string };
};

export function ArticleComposer({
  mode = "create",
  articleId,
  slug,
  initialValues,
}: ArticleComposerProps) {
  const draftKey = mode === "edit" ? null : "draft_article_create";
  const initial = {
    title: initialValues?.title ?? "",
    excerpt: initialValues?.excerpt ?? "",
    content: initialValues?.content ?? "",
  };

  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial,
  );

  const { submit } = useFormSubmit(mode !== "edit" ? resetDraft : undefined, {
    resetOnSuccess: mode !== "edit",
    successMessage:
      mode === "edit"
        ? "Article updated successfully!"
        : "Article published successfully!",
    errorMessage:
      mode === "edit"
        ? "Failed to update article."
        : "Failed to publish article.",
  });

  const previewContent = useMemo(
    () =>
      draftFields.content ||
      "<p>Start writing to see the live article preview.</p>",
    [draftFields.content],
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    await submit(() => {
      if (mode === "edit" && articleId && slug) {
        return updateArticle(formData, articleId, slug);
      } else {
        return createArticle(formData);
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_1.05fr] lg:gap-8">
      <form onSubmit={onSubmit} className="flex flex-col gap-6">
        <div>
          <label className="sb-label">Article Title</label>
          <input
            name="title"
            value={draftFields.title}
            onChange={(event) => updateDraftField("title", event.target.value)}
            placeholder="e.g., The Ultimate PhD Survival Guide"
            className="sb-input"
            required
          />
        </div>

        <div>
          <label className="sb-label">Short Description</label>
          <input
            name="excerpt"
            value={draftFields.excerpt}
            onChange={(event) =>
              updateDraftField("excerpt", event.target.value)
            }
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

          <input type="hidden" name="content" value={draftFields.content} />

          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white">
            <Editor
              value={draftFields.content}
              onChange={(value: string) => updateDraftField("content", value)}
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-slate-100 pt-4">
          <SubmitBtn className="sb-button-accent">
            {mode === "edit" ? "Save Changes" : "Publish Article"}
          </SubmitBtn>
        </div>
      </form>

      {/* Preview Section */}
      <section className="sb-surface-strong overflow-hidden border border-slate-200/70">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500">
              Live Preview
            </p>
            <h2 className="mt-1 text-lg font-semibold text-slate-950">
              {draftFields.title || "Your article"}
            </h2>
          </div>
          <div className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
            {mode === "edit" ? "Editing" : "Draft"}
          </div>
        </div>

        <div className="space-y-5 p-6">
          <p className="text-sm leading-relaxed text-slate-600">
            {draftFields.excerpt || "Your short description will appear here."}
          </p>

          <div className="prose prose-slate max-w-none prose-headings:text-slate-950 prose-a:text-blue-700 hover:prose-a:text-blue-600">
            <RichContent content={previewContent} />
          </div>
        </div>
      </section>
    </div>
  );
}
