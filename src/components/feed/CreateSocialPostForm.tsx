"use client";

import { useRef } from "react";
import { createSocialPost } from "@/app/actions/feed";
import { useToast } from "@/components/ui/Toast";
import { SubmitBtn } from "@/components/ui/SubmitBtn";

export function CreateSocialPostForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { toast } = useToast();

  const handleSubmit = async (formData: FormData) => {
    try {
      await createSocialPost(formData);
      toast("Post published successfully!", "success");
      formRef.current?.reset();
    } catch {
      toast("Failed to create post. Please try again.", "error");
    }
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
        />
        <div className="flex justify-end border-t border-slate-100 pt-4">
          <SubmitBtn className="sb-button-accent">Post Update</SubmitBtn>
        </div>
      </form>
    </div>
  );
}
