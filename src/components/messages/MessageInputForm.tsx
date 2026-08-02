"use client";

import { sendMessage } from "@/app/actions/messages";
import { useEffect, useRef } from "react";

export function MessageInputForm({ conversationId }: { conversationId: string }) {
  const formRef = useRef<HTMLFormElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  const handleInput = () => {
    if (textAreaRef.current) {
      textAreaRef.current.style.height = "auto";
      textAreaRef.current.style.height = `${textAreaRef.current.scrollHeight}px`;
    }
  };
  
  const handleFormAction = async (formData: FormData) => {
    await sendMessage(conversationId, formData)
    formRef.current?.reset();
  }

  return (
    <form
      ref={formRef}
      action={handleFormAction}
      className="p-4 border-t border-slate-200"
    >
      <div className="relative">
        <textarea
          ref={textAreaRef}
          id="body"
          name="body"
          className="sb-input w-full resize-none rounded-full px-5 py-3 pr-16"
          placeholder="Write a message..."
          required
          rows={1}
          onInput={handleInput}
        />
        <button
          type="submit"
          className="absolute right-2 top-1/2 -translate-y-1/2 sb-button-primary h-10 w-10 shrink-0 justify-center rounded-full px-3"
          aria-label="Send message"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 12h14M12 5l7 7-7 7"
            />
          </svg>
        </button>
      </div>
    </form>
  );
}
