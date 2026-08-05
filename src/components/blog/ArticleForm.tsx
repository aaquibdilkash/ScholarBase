"use client";

import { useState, useEffect } from "react";
import { createArticle, updateArticle } from "@/app/actions/blog";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { RichContent } from "@/components/content/RichContent";

export type ArticleFormValues = {
  title: string;
  content: string;
  excerpt: string;
};

export default function ArticleForm({
  mode,
  articleId,
  slug,
  initialValues,
}: {
  mode: "create" | "edit";
  articleId?: string;
  slug?: string;
  initialValues?: Partial<ArticleFormValues>;
}) {
  const initial = {
    title: initialValues?.title ?? "",
    content: initialValues?.content ?? "",
    excerpt: initialValues?.excerpt ?? "",
  };

  const draftKey = mode === "edit" ? null : "draft_article_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial
  );

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage: "Article published successfully!",
      errorMessage: "Failed to save article.",
    },
  );

  const formAction = async () => {
    const formData = new FormData();
    formData.append("title", draftFields.title);
    formData.append("excerpt", draftFields.excerpt);
    formData.append("content", draftFields.content);

    if (mode === "edit" && articleId) {
      await updateArticle(formData, articleId, slug || "");
    } else {
      await submit(() => createArticle(formData));
    }
  };

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <div className="sb-surface-strong p-6 md:p-8">
            <div className="space-y-5">
              <div>
                <label className="sb-label">Article Title</label>
                <input
                  name="title"
                  placeholder="Enter a compelling title"
                  className="sb-input"
                  required
                  value={draftFields.title}
                  onChange={(e) => updateDraftField("title", e.target.value)}
                />
              </div>

              <div>
                <label className="sb-label">Short Excerpt</label>
                <textarea
                  name="excerpt"
                  placeholder="Brief summary for previews and SEO"
                  className="sb-input h-24"
                  value={draftFields.excerpt}
                  onChange={(e) => updateDraftField("excerpt", e.target.value)}
                />
              </div>

              <div>
                <label className="sb-label">Content</label>
                <Editor
                  value={draftFields.content}
                  onChange={(content) => updateDraftField("content", content)}
                />
                <input
                  type="hidden"
                  name="content"
                  value={draftFields.content}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="sb-surface-strong p-6 sticky top-24">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 uppercase tracking-wider mb-4">
              Preview
            </h3>
            <div className="space-y-3">
              <h4 className="text-lg font-semibold text-slate-900 dark:text-slate-100 line-clamp-2">
                {draftFields.title || "Your article title"}
              </h4>
              {draftFields.excerpt && (
                <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-3">
                  {draftFields.excerpt}
                </p>
              )}
              <div className="pt-3 border-t border-slate-200 dark:border-slate-800 prose prose-slate dark:prose-invert max-w-none prose-headings:text-slate-950 dark:prose-headings:text-slate-100 prose-a:text-blue-700 dark:prose-a:text-blue-400 text-xs line-clamp-4">
                <RichContent
                  content={
                    draftFields.content ||
                    "Your article content will appear here..."
                  }
                />
              </div>
            </div>
          </div>

          <div className="sb-surface-strong p-6">
            <SubmitBtnWithAuth className="sb-button-accent w-full">
              {mode === "edit" ? "Update Article" : "Publish Article"}
            </SubmitBtnWithAuth>
            <p className="mt-3 text-xs text-slate-500 text-center">
              {mode === "create"
                ? "Your article will be reviewed before publishing."
                : "Changes will be saved immediately."}
            </p>
          </div>
        </div>
      </div>
    </form>
  );
}
