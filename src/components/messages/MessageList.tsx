"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
import {
  getMessageDetails,
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

type MessageRow = {
  id: string;
  conversationId?: string;
  conversation_id?: string;
  body: string;
  senderId?: string;
  createdAt: string;
  editedAt?: string | null;
  isDeleted?: boolean | null;
  replyToId?: string | null;
  sender?: { id: string; name: string | null; handle: string | null; avatarUrl: string | null };
};

type RealtimePayload = {
  new: MessageRow;
};

export function MessageList({
  conversationId,
  initialMessages,
  user,
  otherParticipantLastReadAt,
  registerAppend,
  registerAddFailed,
  onMessageReceived,
  onMessageRejected,
  onSetReplyingTo,
}: {
  conversationId: string;
  initialMessages: SentMessage[];
  user: User | null;
  otherParticipantLastReadAt: Date;
  registerAppend?: (fn: (message: SentMessage) => void) => void;
  registerAddFailed?: (fn: (message: SentMessage) => void) => void;
  onMessageReceived?: () => void;
  onMessageRejected?: (code: MessageFailureCode) => void;
  /** Marks a message as the active reply target in the composer. */
  onSetReplyingTo?: (message: SentMessage) => void;
}) {
  const { toast } = useToast();
  const [messages, setMessages] = useState<SentMessage[]>(() =>
    [...initialMessages].reverse(),
  );
  const [hasMore, setHasMore] = useState(initialMessages.length === 40);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const observerTarget = useRef<HTMLDivElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const userId = user?.id;
  const isSubscribedRef = useRef(false);

  const initialRenderRef = useRef(true);
  const previousMessageCount = useRef(initialMessages.length);
  const currentMessagesRef = useRef<SentMessage[]>([]);
  useEffect(() => {
    currentMessagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (initialRenderRef.current) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      initialRenderRef.current = false;
      return;
    }

    const diff = messages.length - previousMessageCount.current;
    if (
      !isLoadingMore &&
      (diff === 1 || diff === 0 || previousMessageCount.current === 0)
    ) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
    previousMessageCount.current = messages.length;
  }, [messages, isLoadingMore]);

  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || messages.length === 0) return;
    setIsLoadingMore(true);

    const scrollContainer = containerRef.current;
    const previousScrollHeight = scrollContainer
      ? scrollContainer.scrollHeight
      : 0;

    try {
      const cursor = messages[0].id;
      const olderMessages = await getMoreMessages(conversationId, cursor);
      if (olderMessages.length < 40) setHasMore(false);

      setMessages((prev) => {
        const formattedOlder = [...olderMessages].reverse() as SentMessage[];
        return [...formattedOlder, ...prev];
      });

      requestAnimationFrame(() => {
        if (scrollContainer) {
          const newScrollHeight = scrollContainer.scrollHeight;
          scrollContainer.scrollTop = newScrollHeight - previousScrollHeight;
        }
      });
    } catch (error) {
      console.error("Failed to load more messages", error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, messages, conversationId]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
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
              m.id === message.id ? { ...m, status: "failed", retryable: false } : m,
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
        .forEach((p) => retryMessage({ ...hydrated.find((h) => h.id === p.id)! }));
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

  // ⚡ Stable Realtime subscription effect locked with primitive dependencies
  useEffect(() => {
    if (!conversationId || !userId) return;
    if (isSubscribedRef.current) return;

    const channel = supabase.channel(`realtime:messages:${conversationId}`);

    const handleInsert = async (payload: RealtimePayload) => {
      try {
        const rawMessage = payload.new;
        const msgConvId =
          rawMessage.conversationId || rawMessage.conversation_id;

        if (msgConvId !== conversationId) return;

        const details = await getMessageDetails(rawMessage.id);
        if (!details) return;

        const fetchedMessage = details as SentMessage;
        fetchedMessage.status = "sent";

        setMessages((current) => {
          // Reconcile by the server id first, while also removing a matching
          // optimistic copy. This handles either arrival order: the server
          // action response may beat Realtime, or Realtime may beat it.
          const hasConfirmed = current.some((m) => m.id === fetchedMessage.id);
          const filtered = current.filter(
            (m) =>
              !(
                (m.status === "sending" || m.status === "failed") &&
                m.body === fetchedMessage.body &&
                m.senderId === fetchedMessage.senderId
              ),
          );
          if (hasConfirmed) return filtered;
          return [...filtered, fetchedMessage];
        });

        if (fetchedMessage.senderId !== userId && onMessageReceived) {
          onMessageReceived();
        }
      } catch (error) {
        console.error("Error handling realtime insert:", error);
      }
    };

    // ⚡ ISSUE 6: Realtime sync of edits and tombstoned deletes — applies to
    // both participants without any extra broadcast plumbing.
    const handleUpdate = (payload: RealtimePayload) => {
      const row = payload.new;
      const rowConvId = row.conversationId || row.conversation_id;
      if (rowConvId && rowConvId !== conversationId) return;

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
          // ⚡ QUOTE SYNC: When the original message is tombstoned, every
          // bubble quoting it flips its preview to "Original message was
          // deleted" without any extra fetches or page refresh.
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
    };

    channel
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Message",
          filter: `conversationId=eq.${conversationId}`,
        },
        handleInsert,
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "Message",
          filter: `conversationId=eq.${conversationId}`,
        },
        handleUpdate,
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          isSubscribedRef.current = true;
        } else if (process.env.NODE_ENV === "development") {
          console.warn(`Message realtime status: ${status}`);
        }
      });

    return () => {
      isSubscribedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId, onMessageReceived]);

  if (!user || !userId) return null;

  return (
    <div ref={containerRef} className="space-y-4 h-full overflow-y-auto px-1.5">
      {hasMore && (
        <div
          ref={observerTarget}
          className="flex h-8 w-full items-center justify-center"
        >
          {isLoadingMore && (
            <span className="text-xs text-slate-400">Loading history...</span>
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
