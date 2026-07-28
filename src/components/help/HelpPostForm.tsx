"use client";

import { createHelpPost, updateHelpPost } from "@/app/actions/help";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { useAuthModal } from "@/components/interactions/AuthModal";

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
  isLoggedIn,
}: {
  mode: "create" | "edit";
  helpPostId?: string;
  initialValues?: Partial<HelpPostFormValues>;
  isLoggedIn?: boolean;
}) {
  const { openAuthModal } = useAuthModal();
  const initial = {
    title: initialValues?.title ?? "",
    category: initialValues?.category ?? "",
    subject: initialValues?.subject ?? "",
    message: initialValues?.message ?? "",
  };

  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    `draft_helppost_${mode}`,
    initial,
  );

  const { submitting, submit } = useFormSubmit(
    mode !== "edit" ? resetDraft : undefined,
    {
      resetOnSuccess: mode !== "edit",
      successMessage: "Help post created successfully!",
      errorMessage: "Failed to create help post.",
    },
  );

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (mode === "create" && !isLoggedIn) {
      openAuthModal();
      return;
    }
    const formData = new FormData(e.currentTarget);

    if (mode === "edit" && helpPostId) {
      await updateHelpPost(formData, helpPostId);
    } else {
      await submit(() => createHelpPost(formData));
    }
  }

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
            className="sb-input"
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

        <div className="pt-4 border-t border-slate-100 flex justify-end">
          <SubmitBtnWithAuth
            className={
              mode === "edit" ? "sb-button-accent" : "sb-button-primary"
            }
          >
            {mode === "edit" ? "Save" : "Post"}
          </SubmitBtnWithAuth>
        </div>
      </div>
    </form>
  );
}

