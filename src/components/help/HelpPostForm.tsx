"use client";

import { createHelpPostSafe, updateHelpPostSafe } from "@/app/actions/help";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useToast } from "@/components/ui/Toast";
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
    mutationFn: createHelpPostSafe,
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast(response.error || "Failed to create help post.", "error");
        return;
      }
      const newPost = response.data as HelpPostWithAuthor;
      // Add to the list cache
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
      updateHelpPostSafe(formData, id),
    onSuccess: (response) => {
      if (!response.success || !response.data) {
        toast(response.error || "Failed to update help post.", "error");
        return;
      }
      const updatedPost = response.data as HelpPostWithAuthor;
      // Update the list cache
      queryClient.setQueryData<HelpPostWithAuthor[]>(
        ["helpPosts", { q: "" }],
        (oldData = []) =>
          oldData.map((p) => (p.id === updatedPost.id ? updatedPost : p)),
      );
      // Update the detail cache
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
      <div className="flex flex-col gap-6">
        <div>
          <label className="sb-label">Title</label>
          <input
            type="text"
            name="title"
            placeholder="Enter a descriptive title"
            className="sb-input"
            required
            value={draftFields.title}
            onChange={(e) => updateDraftField("title", e.target.value)}
          />
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
            value={draftFields.subject}
            onChange={(e) => updateDraftField("subject", e.target.value)}
          />
        </div>

        <div>
          <label className="sb-label">Message</label>
          <Editor
            value={draftFields.message}
            onChange={(data) => updateDraftField("message", data)}
          />
          <input type="hidden" name="message" value={draftFields.message} />
        </div>

        <div className="pt-4 border-t border-slate-100 flex justify-end gap-3">
          {mode === "create" && <FormCancelButton href="/help" />}
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
