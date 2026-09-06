"use client";

import { sendMessage } from "@/app/actions/messages";
import { useRef, useState, useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { useToast } from "@/components/ui/Toast";
import type { User } from "@supabase/supabase-js";
import { MAX_MESSAGE_BODY } from "@/lib/constants";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { MESSAGE_BODY_TIP } from "@/constants/tooltips";
import {
  upsertPendingMessage,
  removePendingMessage,
  updatePendingMessageStatus,
} from "@/utils/message-outbox";

const MAX_TEXTAREA_HEIGHT = 160;

export type SentMessage = {
  id: string;
  body: string;
  createdAt: Date | string;
  senderId: string;
  conversationId: string;
  status?: "sending" | "failed" | "sent";
  editedAt?: Date | string | null;
  isDeleted?: boolean | null;
  sender: { id: string; name: string | null; handle: string | null; avatarUrl: string | null; };
};

export function MessageInputForm({
  conversationId,
  onMessageSent,
  onMessageFailed,
  currentUser,
  onTyping,
  isDisabled = false,
}: {
  conversationId: string;
  onMessageSent?: (message: SentMessage) => void;
  /** Called when a send fails so the failed bubble can be shown with Retry. */
  onMessageFailed?: (message: SentMessage) => void;
  currentUser: User;
  onTyping?: () => void;
  /** ⚡ ISSUE 5: Disables the composer when a block relationship exists. */
  isDisabled?: boolean;
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
    if (isSubmitting || isDisabled || !draft.trim()) return;

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

    // 2. ⚡ ISSUE 4: Persist to the offline outbox BEFORE attempting the send.
    // If the user refreshes (even mid-flight/offline), the message is
    // rehydrated by MessageList and retried automatically.
    const pendingMessage = {
      id: tempId,
      conversationId,
      senderId: currentUser.id,
      body: bodyText,
      status: "PENDING" as const,
      createdAt: new Date().toISOString(),
      senderName: optimisticMessage.sender.name,
      senderHandle: optimisticMessage.sender.handle,
      senderAvatarUrl: optimisticMessage.sender.avatarUrl,
    };
    upsertPendingMessage(pendingMessage);

    // 3. Clear input immediately
    setDraft("");
    localStorage.removeItem(`draft-${conversationId}`);
    if (textAreaRef.current) textAreaRef.current.style.height = "auto";

    try {
      const formData = new FormData();
      formData.append("body", bodyText);

      const result = await sendMessage(conversationId, formData);
      if (result && 'error' in result) throw new Error(result.error);
      // ⚡ Outbox entries are only cleared after a confirmed server response.
      removePendingMessage(conversationId, tempId);
      if (result && "id" in result && onMessageSent) {
        onMessageSent({ ...result, status: "sent" });
      }
    } catch {
      // ⚡ ISSUE 4: Keep it queued as FAILED — visible bubble with a Retry
      // button, auto-flushed when connectivity returns.
      updatePendingMessageStatus(conversationId, tempId, "FAILED");
      if (onMessageFailed) onMessageFailed({ ...optimisticMessage, status: "failed" });
      toast("Message not sent. It will be retried when you're back online.", "error");
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
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <textarea
            ref={textAreaRef}
            id="body"
            name="body"
            value={draft}
            onChange={handleInput}
            className="sb-input min-h-[44px] w-full resize-none overflow-y-auto overflow-x-hidden rounded-2xl px-4 py-3 pr-4 disabled:cursor-not-allowed disabled:opacity-60 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800"
            placeholder={isDisabled ? "Messaging is unavailable" : "Write a message..."}
            required
            rows={1}
            maxLength={MAX_MESSAGE_BODY}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            aria-label="Message"
          />
          {!isDisabled && (
            <>
              <span className="absolute -top-5 left-0 text-xs text-slate-400 inline-flex items-center gap-1">
                <InfoTooltip message={MESSAGE_BODY_TIP} />
              </span>
              <span className="absolute -top-5 right-0 text-xs text-slate-400">
                {draft.length}/{MAX_MESSAGE_BODY}
              </span>
            </>
          )}
        </div>
        <button
          type="submit"
          disabled={!draft.trim() || isSubmitting || isDisabled}
          className="sb-button-primary rounded-full !p-0 h-10 w-10 flex items-center justify-center disabled:opacity-50"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}
