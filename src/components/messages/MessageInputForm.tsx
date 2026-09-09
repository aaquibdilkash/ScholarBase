"use client";

import { sendMessage, type MessageFailureCode } from "@/app/actions/messages";
import { useRef, useState, useEffect } from "react";
import { ArrowRight, X } from "lucide-react";
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
  retryable?: boolean;
  editedAt?: Date | string | null;
  isDeleted?: boolean | null;
  replyToId?: string | null;
  sender: { id: string; name: string | null; handle: string | null; avatarUrl: string | null; };
  replyTo?: {
    id: string;
    body: string;
    isDeleted: boolean | null;
    sender: { id: string; name: string | null; handle: string | null; };
  } | null;
};

export function MessageInputForm({
  conversationId,
  onMessageSent,
  onMessageFailed,
  onMessageRejected,
  currentUser,
  onTyping,
  isDisabled = false,
  replyingTo,
  onCancelReply,
}: {
  conversationId: string;
  onMessageSent?: (message: SentMessage) => void;
  /** Called when a send fails so the failed bubble can be shown with Retry. */
  onMessageFailed?: (message: SentMessage) => void;
  onMessageRejected?: (code: MessageFailureCode) => void;
  currentUser: User;
  onTyping?: () => void;
  /** ⚡ ISSUE 5: Disables the composer when a block relationship exists. */
  isDisabled?: boolean;
  /** The message currently being replied to (WhatsApp-style quote). */
  replyingTo?: SentMessage | null;
  /** Clear the active reply target. */
  onCancelReply?: () => void;
}) {
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();
  
  const [draft, setDraft] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(`draft-${conversationId}`);
    if (saved) setDraft(saved);
  }, [conversationId]);

  useEffect(() => {
    if (!replyingTo || isDisabled) return;

    // Wait for the reply preview to render, then bring the composer into view
    // and place the caret where the user can immediately start typing.
    const frame = requestAnimationFrame(() => {
      textAreaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      textAreaRef.current?.focus();
      const end = textAreaRef.current?.value.length ?? 0;
      textAreaRef.current?.setSelectionRange(end, end);
    });

    return () => cancelAnimationFrame(frame);
  }, [replyingTo, isDisabled]);

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
      replyToId: replyingTo?.id ?? null,
      sender: {
        id: currentUser.id,
        name: currentUser.user_metadata?.name || "Scholar",
        handle: currentUser.user_metadata?.handle || "",
        avatarUrl: currentUser.user_metadata?.avatar_url || null,
      },
      replyTo: replyingTo
        ? {
            id: replyingTo.id,
            body: replyingTo.body,
            isDeleted: replyingTo.isDeleted ?? false,
            sender: {
              id: replyingTo.sender.id,
              name: replyingTo.sender.name,
              handle: replyingTo.sender.handle,
            },
          }
        : null,
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
      replyToId: replyingTo?.id ?? null,
    };
    upsertPendingMessage(pendingMessage);

    // 3. Clear input + reply target immediately
    setDraft("");
    localStorage.removeItem(`draft-${conversationId}`);
    if (textAreaRef.current) textAreaRef.current.style.height = "auto";
    onCancelReply?.();

    try {
      const formData = new FormData();
      formData.append("body", bodyText);
      if (replyingTo?.id) formData.append("replyToId", replyingTo.id);

      const result = await sendMessage(conversationId, formData);
      if (result && "success" in result && result.success === false) {
        removePendingMessage(conversationId, tempId);
        onMessageFailed?.({ ...optimisticMessage, status: "failed", retryable: false });
        onMessageRejected?.(result.code);
        toast(result.error, "error");
        return;
      }
      // ⚡ Outbox entries are only cleared after a confirmed server response.
      removePendingMessage(conversationId, tempId);
      if (result && "id" in result && onMessageSent) {
        onMessageSent({ ...result, status: "sent" });
      }
    } catch {
      // ⚡ ISSUE 4: Keep it queued as FAILED — visible bubble with a Retry
      // button, auto-flushed when connectivity returns.
      updatePendingMessageStatus(conversationId, tempId, "FAILED");
      if (onMessageFailed) onMessageFailed({ ...optimisticMessage, status: "failed", retryable: true });
      toast("Message not sent. It will be retried when you're back online.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Escape") {
      e.preventDefault();
      if (onCancelReply && replyingTo) {
        onCancelReply();
      }
      return;
    }
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
      {replyingTo && !isDisabled && (
        <div
          className="mb-2 flex items-start gap-2 rounded-lg border-l-2 border-blue-500 bg-blue-50/70 px-3 py-2 dark:bg-slate-800/80"
          data-testid="reply-preview-banner"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-blue-700 dark:text-blue-300">
                Replying to{" "}
                {replyingTo.sender.name ||
                  (replyingTo.sender.handle ? `@${replyingTo.sender.handle}` : "Scholar")}
              </p>
              {replyingTo.isDeleted ? (
                <p className="mt-0.5 text-xs italic text-slate-500 dark:text-slate-400">
                  Original message deleted
                </p>
              ) : (
                <p className="mt-0.5 line-clamp-1 text-xs text-slate-600 dark:text-slate-300">
                  {replyingTo.body}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onCancelReply}
              className="shrink-0 rounded-full p-1 text-slate-400 transition hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
              aria-label="Cancel reply"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      <div className="flex items-end gap-3">
        <div className="relative flex min-h-[52px] flex-1">
          <textarea
            ref={textAreaRef}
            id="body"
            name="body"
            value={draft}
            onChange={handleInput}
            className="sb-input h-[52px] min-h-[52px] w-full resize-none overflow-y-auto overflow-x-hidden rounded-2xl px-4 !py-3 pr-4 leading-5 disabled:cursor-not-allowed disabled:opacity-60 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800"
            placeholder={isDisabled ? "Messaging is unavailable" : "Write a message..."}
            required
            rows={1}
            maxLength={MAX_MESSAGE_BODY}
            onKeyDown={handleKeyDown}
            disabled={isDisabled}
            aria-label="Message"
          />
          {!isDisabled && (
            <span className="absolute bottom-2 right-3 inline-flex items-center gap-1 text-[10px] tabular-nums text-slate-400">
              <InfoTooltip message={MESSAGE_BODY_TIP} />
              {draft.length}/{MAX_MESSAGE_BODY}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!draft.trim() || isSubmitting || isDisabled}
          className="sb-button-primary h-[52px] w-[52px] shrink-0 !p-0 disabled:opacity-50"
        >
          <ArrowRight className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}
