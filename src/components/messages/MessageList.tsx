"use client";

import { useEffect, useLayoutEffect, useState, useRef, useCallback } from "react";
import {
  getMoreMessages,
  editMessage,
  deleteMessage,
  sendMessage,
} from "@/app/actions/messages";
import { MessageItem } from "./MessageItem";
import { useToast } from "@/components/ui/Toast";
import type { User } from "@supabase/supabase-js";
import type { SentMessage } from "./MessageInputForm";
import {
  getOutboxForConversation,
  removePendingMessage,
  updatePendingMessageStatus,
} from "@/utils/message-outbox";
import { type MessageFailureCode } from "@/app/actions/messages";
import { MESSAGE_THREAD_PAGE_SIZE } from "@/constants/messages";

/**
 * Shape of a message row as delivered by the Realtime Broadcast from Database
 * trigger (`supabase/realtime/broadcast-messages.sql`). The trigger sends the
 * curated payload, so this is already the full `SentMessage` — which is what
 * let the old `getMessageDetails` server-action round-trip be deleted.
 */
type MessageRow = {
  id: string;
  conversationId?: string;
  conversation_id?: string;
  body: string;
  senderId?: string;
  /** The trigger always emits an ISO-8601 string; widened so a `SentMessage`
   *  (whose server-action round-trip yields a `Date`) also satisfies this. */
  createdAt: Date | string;
  editedAt?: Date | string | null;
  isDeleted?: boolean | null;
  replyToId?: string | null;
  sender?: {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
  };
};

export function MessageList({
  conversationId,
  initialMessages,
  user,
  otherParticipantLastReadAt,
  registerAppend,
  registerAddFailed,
  registerUpdate,
  onMessageRejected,
  onSetReplyingTo,
}: {
  conversationId: string;
  initialMessages: SentMessage[];
  user: User | null;
  otherParticipantLastReadAt: Date;
  registerAppend?: (fn: (message: SentMessage) => void) => void;
  registerAddFailed?: (fn: (message: SentMessage) => void) => void;
  /**
   * Receives an edit / tombstone broadcast for a message already in the thread.
   *
   * This component no longer owns a Realtime channel of its own: the conversation
   * page holds the single `conversation:<id>` channel and forwards both the
   * INSERT and the UPDATE event here, so a message is delivered once rather than
   * by three overlapping subscriptions.
   */
  registerUpdate?: (fn: (message: MessageRow) => void) => void;
  onMessageRejected?: (code: MessageFailureCode) => void;
  /** Marks a message as the active reply target in the composer. */
  onSetReplyingTo?: (message: SentMessage) => void;
}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<SentMessage[]>(() =>
    [...initialMessages].reverse(),
  );
  const [hasMore, setHasMore] = useState(
    initialMessages.length === MESSAGE_THREAD_PAGE_SIZE,
  );
  const [isLoadingMore, setIsLoadingMore] = useState(false);

   const observerTarget = useRef<HTMLDivElement | null>(null);
   const containerRef = useRef<HTMLDivElement | null>(null);
   const messagesEndRef = useRef<HTMLDivElement | null>(null);
   const sentinelWasVisibleRef = useRef(false);
   const userId = user?.id;

    const getScrollContainer = useCallback(() => {
      const container = containerRef.current;
      if (!container) return null;
      let el: HTMLElement | null = container.parentElement;
      while (el) {
        const style = getComputedStyle(el);
        if (
          style.overflowY === "auto" ||
          style.overflowY === "scroll" ||
          style.overflow === "auto" ||
          style.overflow === "scroll"
        ) {
          return el;
        }
        el = el.parentElement;
      }
      return null;
    }, []);

   const initialRenderRef = useRef(true);
   const previousMessageCount = useRef(initialMessages.length);
   const currentMessagesRef = useRef<SentMessage[]>([]);
   const scrollHeightRef = useRef<number | null>(null);

   useEffect(() => {
     currentMessagesRef.current = messages;
   }, [messages]);

    useLayoutEffect(() => {
      if (initialRenderRef.current) {
        const scrollContainer = getScrollContainer();
        if (scrollContainer) {
          scrollContainer.scrollTop = scrollContainer.scrollHeight;
        }
        initialRenderRef.current = false;
        scrollHeightRef.current = null;
        return;
      }

      const scrollContainer = getScrollContainer();
      if (!scrollContainer) return;

      const wasPrepended =
        scrollHeightRef.current !== null &&
        messages.length > previousMessageCount.current;

      if (wasPrepended) {
        const oldScrollHeight = scrollHeightRef.current!;
        const heightDiff = scrollContainer.scrollHeight - oldScrollHeight;
        scrollContainer.scrollTop = heightDiff;
        scrollHeightRef.current = null;
      } else {
        scrollHeightRef.current = scrollContainer.scrollHeight;
      }

      previousMessageCount.current = messages.length;
    }, [messages, getScrollContainer]);

    const loadMore = useCallback(async () => {
      if (isLoadingMore || !hasMore || messages.length === 0) return;
      setIsLoadingMore(true);

      const scrollContainer = getScrollContainer();
      if (scrollContainer) {
        scrollHeightRef.current = scrollContainer.scrollHeight;
      }

      try {
        const cursor = messages[0].id;
        const olderMessages = await getMoreMessages(conversationId, cursor);
        if (olderMessages.length < MESSAGE_THREAD_PAGE_SIZE) setHasMore(false);

        setMessages((prev) => {
          const formattedOlder = [...olderMessages].reverse() as SentMessage[];
          return [...formattedOlder, ...prev];
        });
      } catch (error) {
        scrollHeightRef.current = null;
        console.error("Failed to load more messages", error);
      } finally {
        setIsLoadingMore(false);
      }
    }, [isLoadingMore, hasMore, messages, conversationId, getScrollContainer]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const isVisible = entries[0].isIntersecting;
        if (isVisible && !sentinelWasVisibleRef.current) {
          void loadMore();
        }
        sentinelWasVisibleRef.current = isVisible;
      },
      { threshold: 1.0 },
    );
    if (observerTarget.current) observer.observe(observerTarget.current);
    return () => observer.disconnect();
  }, [loadMore]);

  useEffect(() => {
    if (registerAppend) {
      registerAppend((message: SentMessage) => {
        setMessages((current) => {
          const hasConfirmed = current.some((m) => m.id === message.id);
          const withoutOptimisticEcho = current.filter(
            (m) =>
              !(
                (m.status === "sending" || m.status === "failed") &&
                m.body === message.body &&
                m.senderId === message.senderId
              ),
          );
          if (hasConfirmed) return withoutOptimisticEcho;

          return [...withoutOptimisticEcho, message];
        });
      });
    }
  }, [registerAppend]);

  useEffect(() => {
    if (registerAddFailed) {
      registerAddFailed((message: SentMessage) => {
        setMessages((current) => {
          // Update the existing optimistic bubble (matched by temp id) to
          // failed, or append if it is not present yet.
          const index = current.findIndex((m) => m.id === message.id);
          if (index >= 0) {
            const next = [...current];
            next[index] = message;
            return next;
          }
          return [...current, message];
        });
      });
    }
  }, [registerAddFailed]);

  // ⚡ EDITS + TOMBSTONES: the conversation page forwards the Realtime
  // `UPDATE` broadcast here. A deleted message renders as a tombstone with an
  // empty body, and every bubble quoting it flips its preview — same behaviour
  // the removed `postgres_changes` UPDATE listener had, minus the channel.
  useEffect(() => {
    if (!registerUpdate) return;

    registerUpdate((row: MessageRow) => {
      setMessages((current) =>
        current.map((m) => {
          if (m.id === row.id) {
            return {
              ...m,
              body: row.isDeleted ? "" : row.body,
              editedAt: row.editedAt ?? m.editedAt,
              isDeleted: row.isDeleted,
            };
          }
          // ⚡ QUOTE SYNC: keep bubbles quoting a tombstoned message accurate.
          if (m.replyToId === row.id && m.replyTo) {
            return {
              ...m,
              replyTo: {
                ...m.replyTo,
                isDeleted: row.isDeleted ?? m.replyTo.isDeleted,
              },
            };
          }
          return m;
        }),
      );
    });
  }, [registerUpdate]);

  // ⚡ ISSUE 4: Offline outbox — retry a pending/failed message.
  const retryMessage = useCallback(
    async (message: SentMessage) => {
      setMessages((current) =>
        current.map((m) =>
          m.id === message.id ? { ...m, status: "sending" } : m,
        ),
      );

      try {
        const formData = new FormData();
        formData.append("body", message.body);
        if (message.replyToId) formData.append("replyToId", message.replyToId);
        const result = await sendMessage(conversationId, formData);
        if (result && "success" in result && result.success === false) {
          removePendingMessage(conversationId, message.id);
          setMessages((current) =>
            current.map((m) =>
              m.id === message.id
                ? { ...m, status: "failed", retryable: false }
                : m,
            ),
          );
          onMessageRejected?.(result.code);
          toast(result.error, "error");
          return;
        }

        // Confirmed by the server → safe to drop from the local outbox.
        removePendingMessage(conversationId, message.id);

        const created = result as SentMessage;
        setMessages((current) =>
          current.map((m) =>
            m.id === message.id ? { ...created, status: "sent" as const } : m,
          ),
        );
      } catch {
        updatePendingMessageStatus(conversationId, message.id, "FAILED");
        setMessages((current) =>
          current.map((m) =>
            m.id === message.id ? { ...m, status: "failed" } : m,
          ),
        );
        toast("Still offline — message will be retried.", "error");
      }
    },
    [conversationId, onMessageRejected, toast],
  );

  // ⚡ ISSUE 4: Rehydrate pending/failed messages after a refresh while
  // offline, and auto-flush the queue when connectivity returns.
  useEffect(() => {
    if (!user) return;

    const outbox = getOutboxForConversation(conversationId);
    if (outbox.length > 0) {
      const hydrated: SentMessage[] = outbox.map((pending) => {
        // Restore the quoted snapshot so the bubble renders the quote header.
        const quoted = pending.replyToId
          ? currentMessagesRef.current.find((m) => m.id === pending.replyToId)
          : undefined;
        return {
          id: pending.id,
          body: pending.body,
          createdAt: pending.createdAt,
          senderId: pending.senderId,
          conversationId: pending.conversationId,
          status: pending.status === "PENDING" ? "sending" : "failed",
          replyToId: pending.replyToId,
          sender: {
            id: pending.senderId,
            name: pending.senderName,
            handle: pending.senderHandle,
            avatarUrl: pending.senderAvatarUrl,
          },
          replyTo: quoted
            ? {
                id: quoted.id,
                body: quoted.body,
                isDeleted: quoted.isDeleted ?? false,
                sender: {
                  id: quoted.sender.id,
                  name: quoted.sender.name,
                  handle: quoted.sender.handle,
                },
              }
            : null,
        };
      });
      setMessages((current) => {
        const existing = new Set(current.map((m) => m.id));
        return [...current, ...hydrated.filter((m) => !existing.has(m.id))];
      });

      // Anything still PENDING never reached the server — retry it now.
      outbox
        .filter((p) => p.status === "PENDING")
        .forEach((p) =>
          retryMessage({ ...hydrated.find((h) => h.id === p.id)! }),
        );
    }

    const handleOnline = () => {
      const queue = getOutboxForConversation(conversationId);
      queue.forEach((pending) => {
        retryMessage({
          id: pending.id,
          body: pending.body,
          createdAt: pending.createdAt,
          senderId: pending.senderId,
          conversationId: pending.conversationId,
          status: "failed",
          replyToId: pending.replyToId,
          sender: {
            id: pending.senderId,
            name: pending.senderName,
            handle: pending.senderHandle,
            avatarUrl: pending.senderAvatarUrl,
          },
        });
      });
    };

    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, user?.id]);

  // ⚡ ISSUE 6: Optimistic edit/delete handlers.
  const handleEdit = useCallback(
    async (messageId: string, newBody: string) => {
      const previous = messages.find((m) => m.id === messageId);
      // Optimistic UI: update instantly, reconcile with the server result.
      setMessages((current) =>
        current.map((m) =>
          m.id === messageId
            ? { ...m, body: newBody, editedAt: new Date() }
            : m,
        ),
      );
      const result = await editMessage(messageId, newBody);
      if (result && "error" in result) {
        if (previous) {
          setMessages((current) =>
            current.map((m) => (m.id === messageId ? previous : m)),
          );
        }
        toast(result.error ?? "Could not edit the message.", "error");
        return false;
      }
      return true;
    },
    [messages, toast],
  );

  const handleDelete = useCallback(
    async (messageId: string) => {
      // Optimistic UI: tombstone instantly.
      setMessages((current) =>
        current.map((m) =>
          m.id === messageId ? { ...m, isDeleted: true, body: "" } : m,
        ),
      );
      const result = await deleteMessage(messageId);
      if (result && "error" in result) {
        toast(result.error ?? "Could not delete the message.", "error");
        return false;
      }
      return true;
    },
    [toast],
  );

  if (!user || !userId) return null;

  return (
    <div
      ref={containerRef}
      className="space-y-4 h-full overflow-y-auto px-0.5 sm:px-1.5"
    >
      {hasMore && (
        <div
          ref={observerTarget}
          className="flex h-8 w-full items-center justify-center"
        >
          {isLoadingMore ? (
            <span className="text-xs text-slate-400">
              Loading older messages...
            </span>
          ) : (
            <span className="text-xs text-slate-500">
              Scroll up to load older messages
            </span>
          )}
        </div>
      )}

      {messages.map((message) => (
        <MessageItem
          key={message.id}
          message={message}
          currentUserId={userId}
          otherParticipantLastReadAt={otherParticipantLastReadAt}
          onEdit={handleEdit}
          onDelete={handleDelete}
          onRetry={retryMessage}
          onSetReplyingTo={onSetReplyingTo}
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
