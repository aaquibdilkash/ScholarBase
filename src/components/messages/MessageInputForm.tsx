"use client";

import { sendMessage } from "@/app/actions/messages";
import { useRef, useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { User } from "@supabase/supabase-js";

const MAX_TEXTAREA_HEIGHT = 160;

export type SentMessage = {
  id: string;
  body: string;
  createdAt: Date | string;
  senderId: string;
  conversationId: string;
  status?: "sending" | "failed" | "sent";
  sender: { id: string; name: string | null; handle: string | null; avatarUrl: string | null; };
};

export function MessageInputForm({
  conversationId,
  onMessageSent,
  currentUser,
  onTyping,
}: {
  conversationId: string;
  onMessageSent?: (message: SentMessage) => void;
  currentUser: User;
  onTyping?: () => void;
}) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`draft-${conversationId}`);
    if (saved) setDraft(saved);
  }, [conversationId]);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(e.target.value);
    localStorage.setItem(`draft-${conversationId}`, e.target.value);
    if (onTyping) onTyping();

    if (textAreaRef.current) {
      textAreaRef.current.style.height = "auto";
      const nextHeight = Math.min(textAreaRef.current.scrollHeight, MAX_TEXTAREA_HEIGHT);
      textAreaRef.current.style.height = `${nextHeight}px`;
    }
  };

  // ⚡ INSTANT CLIENT-SIDE ONSUBMIT (Zero Latency)
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (isSubmitting || !draft.trim()) return;

    const bodyText = draft;
    setIsSubmitting(true);

    // 1. Instantly display bubble
    const tempId = `optimistic-${Date.now()}`;
    const optimisticMessage: SentMessage = {
      id: tempId,
      body: bodyText,
      createdAt: new Date(),
      senderId: currentUser.id,
      conversationId,
      status: "sending",
      sender: {
        id: currentUser.id,
        name: currentUser.user_metadata?.name || "Scholar",
        handle: currentUser.user_metadata?.handle || "",
        avatarUrl: currentUser.user_metadata?.avatar_url || null,
      },
    };

    if (onMessageSent) onMessageSent(optimisticMessage);
    
    // 2. Clear input immediately
    setDraft("");
    localStorage.removeItem(`draft-${conversationId}`);
    if (textAreaRef.current) textAreaRef.current.style.height = "auto";

    try {
      const formData = new FormData();
      formData.append("body", bodyText);

      const result = await sendMessage(conversationId, formData);
      if (result && 'error' in result) throw new Error(result.error);
      if (result && "id" in result && onMessageSent) {
        onMessageSent({ ...result, status: "sent" });
      }
    } catch {
      toast("Failed to send. Text saved to draft.", "error");
      setDraft(bodyText);
      localStorage.setItem(`draft-${conversationId}`, bodyText);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!isSubmitting && draft.trim()) {
        const form = e.currentTarget.form;
        if (form) form.requestSubmit();
      }
    }
  };

  return (
    <form onSubmit={handleSubmit} className="shrink-0 border-t border-slate-200 p-3 sm:p-4 dark:border-slate-800">
      <div className="flex items-end gap-2">
        <textarea
          ref={textAreaRef}
          id="body"
          name="body"
          value={draft}
          onChange={handleInput}
          className="sb-input min-h-[44px] w-full resize-none overflow-y-auto overflow-x-hidden rounded-2xl px-4 py-3 pr-4 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800"
          placeholder="Write a message..."
          required
          rows={1}
          onKeyDown={handleKeyDown}
        />
        <button
          type="submit"
          disabled={!draft.trim() || isSubmitting}
          className="mb-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-950 text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}
