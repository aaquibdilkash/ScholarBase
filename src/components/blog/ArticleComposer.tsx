"use client";

import { useMemo } from "react";
import dynamic from "next/dynamic";
import { RichContent } from "@/components/content/RichContent";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { createArticle, updateArticle } from "@/app/actions/blog";
import { useFormDraft } from "@/hooks/useFormDraft";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/Toast";
import { CautionNote } from "@/components/ui/CautionNote";
import {
  MAX_ARTICLE_TITLE,
  MAX_ARTICLE_EXCERPT,
  MAX_ARTICLE_CONTENT,
} from "@/lib/constants";
import { getRichTextLength } from "@/lib/html";
import type { Article } from "@prisma/client";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  ARTICLE_TITLE_TIP,
  ARTICLE_EXCERPT_TIP,
  ARTICLE_CONTENT_TIP,
} from "@/constants/tooltips";

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

  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();

  const createMutation = useMutation({
    mutationFn: createArticle,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast("Failed to publish article.", "error");
        return;
      }
      const newArticle = response.data as Article;
      queryClient.setQueryData<Article[]>(
        ["articles", { q: "" }],
        (oldData = []) => [newArticle, ...oldData],
      );
      resetDraft();
      toast("Article published successfully!", "success");
      router.push(`/blog/${newArticle.slug}`);
    },
    onError: (error) => {
      toast(error.message, "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ formData, id }: { formData: FormData; id: string }) =>
      updateArticle(formData, id),
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast("Failed to update article.", "error");
        return;
      }
      const updatedArticle = response.data as Article;
      queryClient.setQueryData<Article[]>(
        ["articles", { q: "" }],
        (oldData = []) =>
          oldData.map((p) => (p.id === updatedArticle.id ? updatedArticle : p)),
      );
      if (slug && updatedArticle.slug !== slug) {
        queryClient.removeQueries({ queryKey: ["article", slug] });
      }
      queryClient.setQueryData(
        ["article", updatedArticle.slug],
        updatedArticle,
      );
      toast("Article updated successfully!", "success");
      router.push(`/blog/${updatedArticle.slug}`);
    },
    onError: (error) => {
      toast(error.message, "error");
    },
  });

  const previewContent = useMemo(
    () =>
      draftFields.content ||
      "<p>Start writing to see the live article preview.</p>",
    [draftFields.content],
  );

  const isContentOverLimit =
    getRichTextLength(draftFields.content) > MAX_ARTICLE_CONTENT;
  const isFormOverLimit = isContentOverLimit;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isFormOverLimit) return;

    const formData = new FormData(e.currentTarget);

    if (mode === "edit" && articleId) {
      updateMutation.mutate({ formData, id: articleId });
    } else {
      createMutation.mutate(formData);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-6">
      <CautionNote />
      <div className="grid gap-6 lg:h-[800px] lg:grid-cols-[1fr_1.05fr] lg:items-stretch lg:gap-8 xl:h-[840px]">
        {/* Left column: form fields. Content editor is flex-1 so the whole
            left column stretches to match the right (preview) column height. */}
        <div className="flex min-h-0 min-w-0 flex-col gap-6">
         <div>
           <label className="sb-label inline-flex items-center gap-1.5">
             Article Title
             <InfoTooltip message={ARTICLE_TITLE_TIP} />
           </label>
          <input
            name="title"
            value={draftFields.title}
            onChange={(event) => updateDraftField("title", event.target.value)}
            placeholder="e.g., The Ultimate PhD Survival Guide"
            className="sb-input"
            required
            maxLength={MAX_ARTICLE_TITLE}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.title.length}/{MAX_ARTICLE_TITLE} characters
          </div>
        </div>

         <div>
           <label className="sb-label inline-flex items-center gap-1.5">
             Short Description
             <InfoTooltip message={ARTICLE_EXCERPT_TIP} />
           </label>
          <input
            name="excerpt"
            value={draftFields.excerpt}
            onChange={(event) =>
              updateDraftField("excerpt", event.target.value)
            }
            placeholder="A brief summary of your article..."
            className="sb-input"
            required
            maxLength={MAX_ARTICLE_EXCERPT}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.excerpt.length}/{MAX_ARTICLE_EXCERPT} characters
          </div>
        </div>

         <div className="flex min-h-0 min-w-0 flex-1 flex-col">
           <div className="mb-3 flex items-center justify-between gap-3">
             <label className="sb-label mb-0 inline-flex items-center gap-1.5">
               Content
               <InfoTooltip message={ARTICLE_CONTENT_TIP} />
             </label>
            <span className="rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
              SB Editor
            </span>
          </div>

          {/* Mobile: flows with the page (no fixed height, no inner scroll).
              Desktop: lg:flex-1 + min-h-0 makes this box end exactly where the
              preview column ends, so only very long content scrolls inside. */}
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white lg:min-h-0 lg:flex-1">
            <Editor
              maxLength={MAX_ARTICLE_CONTENT}
              value={draftFields.content}
              onChange={(value: string) => updateDraftField("content", value)}
              className="min-h-0 lg:flex-1"
              scrollable
            />
            <input type="hidden" name="content" value={draftFields.content} />
          </div>
        </div>
        </div>

        {/* Right column: preview card. On mobile it flows with the page (no
            fixed height, no inner scroll). On desktop it is bounded by the grid
            row height so only the body below the frozen header scrolls. */}
        <section className="sb-surface-strong flex min-h-0 min-w-0 flex-col overflow-hidden border border-slate-200/70 lg:min-h-0 lg:flex-1">
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-100 px-6 py-4 dark:border-slate-800">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                  Live Preview
                </p>
                <h2 className="mt-1 truncate text-lg font-semibold text-slate-950 dark:text-slate-50">
                  {draftFields.title || "Your article"}
                </h2>
              </div>
              <div className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700 dark:border-blue-900 dark:bg-blue-950/60 dark:text-blue-300">
                {mode === "edit" ? "Editing" : "Draft"}
              </div>
            </div>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
              <p className="break-words text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                {draftFields.excerpt || "Your short description will appear here."}
              </p>

              <div className="prose prose-slate dark:prose-invert max-w-none prose-headings:text-slate-950 dark:prose-headings:text-slate-100 prose-a:text-blue-700 dark:prose-a:text-blue-400 hover:prose-a:text-blue-600 hover:dark:prose-a:text-blue-300">
                <RichContent content={previewContent} />
              </div>
            </div>
        </section>
      </div>

      {/* Actions on the next line, right-aligned under the preview. */}
      <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
        <FormCancelButton />
        <SubmitBtnWithAuth disabled={isPending || isFormOverLimit} loadingText={mode === "edit" ? "Saving..." : "Publishing..."} className="sb-button-accent">
          {isPending
            ? mode === "edit"
              ? "Saving..."
              : "Publishing..."
            : mode === "edit"
              ? "Save Changes"
              : "Publish Article"}
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
