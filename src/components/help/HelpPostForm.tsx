"use client";

import { createHelpPost, updateHelpPost } from "@/app/actions/help";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useToast } from "@/components/ui/Toast";
import { CautionNote } from "@/components/ui/CautionNote";
import {
  MAX_HELP_POST_TITLE,
  MAX_HELP_POST_SUBJECT,
  MAX_HELP_POST_MESSAGE,
} from "@/lib/constants";
import type { HelpPostWithAuthor } from "@/types/cards";

export type HelpPostFormValues = {
  title: string;
  category: string;
  subject: string;
  message: string;
};

export default function HelpPostForm({
  mode,
  helpPostId,
  initialValues,
}: {
  mode: "create" | "edit";
  helpPostId?: string;
  initialValues?: Partial<HelpPostFormValues>;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const { toast } = useToast();
  const initial = {
    title: initialValues?.title ?? "",
    category: initialValues?.category ?? "",
    subject: initialValues?.subject ?? "",
    message: initialValues?.message ?? "",
  };

  const draftKey = mode === "edit" ? null : "draft_helppost_create";
  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    draftKey,
    initial,
  );

  const createMutation = useMutation({
    mutationFn: createHelpPost,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast("Failed to create help post.", "error");
        return;
      }
      const newPost = response.data as HelpPostWithAuthor;
      queryClient.setQueryData<HelpPostWithAuthor[]>(
        ["helpPosts", { q: "" }],
        (oldData = []) => [newPost, ...oldData],
      );
      resetDraft();
      toast("Help post created successfully!", "success");
      router.push(`/help/${newPost.id}`);
    },
    onError: (error) => {
      toast(error.message, "error");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ formData, id }: { formData: FormData; id: string }) =>
      updateHelpPost(formData, id),
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast("Failed to update help post.", "error");
        return;
      }
      const updatedPost = response.data as HelpPostWithAuthor;
      queryClient.setQueryData<HelpPostWithAuthor[]>(
        ["helpPosts", { q: "" }],
        (oldData = []) =>
          oldData.map((p) => (p.id === updatedPost.id ? updatedPost : p)),
      );
      queryClient.setQueryData(["helpPost", updatedPost.id], updatedPost);
      toast("Help post updated successfully!", "success");
      router.push(`/help/${updatedPost.id}`);
    },
    onError: (error) => {
      toast(error.message, "error");
    },
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    if (mode === "edit" && helpPostId) {
      updateMutation.mutate({ formData, id: helpPostId });
    } else {
      createMutation.mutate(formData);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <form onSubmit={onSubmit} className="sb-surface-strong p-8 md:p-10">
      <CautionNote />
      <div className="flex flex-col gap-6">
        <div>
          <label className="sb-label">Title</label>
          <input
            type="text"
            name="title"
            placeholder="Enter a descriptive title"
            className="sb-input"
            required
            maxLength={MAX_HELP_POST_TITLE}
            value={draftFields.title}
            onChange={(e) => updateDraftField("title", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.title.length}/{MAX_HELP_POST_TITLE} characters
          </div>
        </div>

        <div>
          <label className="sb-label">Category</label>
          <select
            name="category"
            className="sb-select"
            required
            value={draftFields.category}
            onChange={(e) => updateDraftField("category", e.target.value)}
          >
            <option value="">Select a category</option>
            <option value="Bug">Bug Report</option>
            <option value="feature">Feature Request</option>
            <option value="improvement">Site Improvement</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="sb-label">Subject</label>
          <input
            name="subject"
            placeholder="Short summary of your requirement..."
            className="sb-input"
            required
            maxLength={MAX_HELP_POST_SUBJECT}
            value={draftFields.subject}
            onChange={(e) => updateDraftField("subject", e.target.value)}
          />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {draftFields.subject.length}/{MAX_HELP_POST_SUBJECT} characters
          </div>
        </div>

        <div>
          <label className="sb-label">Message</label>
          <Editor
            value={draftFields.message}
            onChange={(data) => updateDraftField("message", data)}
            maxLength={MAX_HELP_POST_MESSAGE}
          />
          <input type="hidden" name="message" value={draftFields.message} />
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            {String(draftFields.message.length).replace(/(\d+)(?=.(\d{3})*$)/g, "$1,")}/{MAX_HELP_POST_MESSAGE} characters
          </div>
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
          <FormCancelButton />
          <SubmitBtnWithAuth
            disabled={isPending}
            className={
              mode === "edit" ? "sb-button-accent" : "sb-button-primary"
            }
          >
            {isPending
              ? mode === "edit"
                ? "Saving..."
                : "Posting..."
              : mode === "edit"
                ? "Save"
                : "Post"}
          </SubmitBtnWithAuth>
        </div>
      </div>
    </form>
  );
}
