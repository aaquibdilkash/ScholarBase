"use client";

import { useRef } from "react";
import { createSocialPost } from "@/app/actions/feed";
import { useToast } from "@/components/ui/Toast";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useFormSubmit } from "@/hooks/useFormSubmit";

export function CreateSocialPostForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  const [draftFields, updateDraftField, resetDraft] = useFormDraft(
    "draft_social_post",
    { content: "" },
  );

  const { submitting, submit } = useFormSubmit(resetDraft, {
    resetOnSuccess: true,
    successMessage: "Post published successfully!",
    errorMessage: "Failed to create post.",
  });

  const handleSubmit = async (formData: FormData) => {
    await submit(() => createSocialPost(formData));
    formRef.current?.reset();
  };

  return (
    <div className="sb-surface-strong mb-10 p-6 md:p-7">
      <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
        <textarea
          name="content"
          placeholder="What are you researching today?"
          className="w-full resize-none border-none bg-transparent p-2 text-lg text-slate-800 outline-none placeholder:text-slate-400 focus:ring-0"
          rows={3}
          required
          value={draftFields.content}
          onChange={(e) => updateDraftField("content", e.target.value)}
        />
        <div className="flex justify-end border-t border-slate-100 pt-4">
          <SubmitBtn className="sb-button-accent">Post Update</SubmitBtn>
        </div>
      </form>
    </div>
  );
}
