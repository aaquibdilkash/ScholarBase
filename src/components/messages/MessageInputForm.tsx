"use client";

import { sendMessage } from "@/app/actions/messages";
import { useRef } from "react";
import { ArrowRight } from "lucide-react";

const MAX_TEXTAREA_HEIGHT = 160; // px (roughly max-h-40)

export function MessageInputForm({
  conversationId,
}: {
  conversationId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const resetTextareaHeight = () => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "auto";
    }
  };

  const handleInput = () => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "auto";
      const nextHeight = Math.min(
        textAreaRef.current.scrollHeight,
        MAX_TEXTAREA_HEIGHT,
      );
      textAreaRef.current.style.height = `${nextHeight}px`;
    }
  };

  const handleFormAction = async (formData: FormData) => {
    await sendMessage(conversationId, formData);
    formRef.current?.reset();
    resetTextareaHeight();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  };

  return (
    <form
      ref={formRef}
      action={handleFormAction}
      className="shrink-0 border-t border-slate-200 p-3 sm:p-4 dark:border-slate-800"
    >
      <div className="flex items-end gap-2">
        <textarea
          ref={textAreaRef}
          id="body"
          name="body"
          className="sb-input min-h-0 w-full resize-none overflow-y-auto rounded-2xl px-4 py-3 pr-4"
          placeholder="Write a message..."
          required
          rows={1}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white transition hover:bg-slate-800"
          aria-label="Send message"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}
