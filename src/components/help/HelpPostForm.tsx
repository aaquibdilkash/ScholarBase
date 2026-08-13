"use client";

import { updateHelpPost, createHelpPostSafe } from "@/app/actions/help";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";
import { Editor } from "@/components/ui/Editor";
import { FormCancelButton } from "@/components/ui/FormCancelButton";

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

  const { submit } = useFormSubmit(mode !== "edit" ? resetDraft : undefined, {
    resetOnSuccess: mode !== "edit",
    successMessage: "Help post created successfully!",
    errorMessage: "Failed to create help post.",
  });

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);

    await submit(() => {
      if (mode === "edit" && helpPostId) {
        return updateHelpPost(formData, helpPostId);
      } else {
        return createHelpPostSafe(formData);
      }
    });
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
