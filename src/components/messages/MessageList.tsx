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

type MessageRow = {
  id: string;
  conversationId?: string;
  conversation_id?: string;
  body: string;
  senderId?: string;
  createdAt: string;
  editedAt?: string | null;
  isDeleted?: boolean | null;
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
}: {
  conversationId: string;
  initialMessages: SentMessage[];
  user: User | null;
  otherParticipantLastReadAt: Date;
  registerAppend?: (fn: (message: SentMessage) => void) => void;
  registerAddFailed?: (fn: (message: SentMessage) => void) => void;
  onMessageReceived?: () => void;
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
          if (current.some((m) => m.id === message.id)) return current;

          if (message.status === "sent") {
            const optimisticIndex = current.findIndex(
              (m) =>
                (m.status === "sending" || m.status === "failed") &&
                m.body === message.body &&
                m.senderId === message.senderId,
            );
            if (optimisticIndex >= 0) {
              const next = [...current];
              next[optimisticIndex] = message;
              return next;
            }
          }

          return [...current, message];
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
        const result = await sendMessage(conversationId, formData);
        if (result && "error" in result) throw new Error(result.error);

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
    [conversationId, toast],
  );

  // ⚡ ISSUE 4: Rehydrate pending/failed messages after a refresh while
  // offline, and auto-flush the queue when connectivity returns.
  useEffect(() => {
    if (!user) return;

    const outbox = getOutboxForConversation(conversationId);
    if (outbox.length > 0) {
      const hydrated: SentMessage[] = outbox.map((pending) => ({
        id: pending.id,
        body: pending.body,
        createdAt: pending.createdAt,
        senderId: pending.senderId,
        conversationId: pending.conversationId,
        status: pending.status === "PENDING" ? "sending" : "failed",
        sender: {
          id: pending.senderId,
          name: pending.senderName,
          handle: pending.senderHandle,
          avatarUrl: pending.senderAvatarUrl,
        },
      }));
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
          // Replace any temporary optimistic "sending"/"failed" message with
          // the real one.
          const filtered = current.filter(
            (m) =>
              !(
                (m.status === "sending" || m.status === "failed") &&
                m.body === fetchedMessage.body &&
                m.senderId === fetchedMessage.senderId
              ),
          );
          if (filtered.some((m) => m.id === fetchedMessage.id)) return current;
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
        current.map((m) =>
          m.id === row.id
            ? {
                ...m,
                body: row.isDeleted ? "" : row.body,
                editedAt: row.editedAt ?? m.editedAt,
                isDeleted: row.isDeleted,
              }
            : m,
        ),
      );
    };

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Message" },
        handleInsert,
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "Message" },
        handleUpdate,
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") isSubscribedRef.current = true;
      });

    return () => {
      isSubscribedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [conversationId, userId, onMessageReceived]);

  if (!user || !userId) return null;

  return (
    <div ref={containerRef} className="space-y-4 h-full overflow-y-auto">
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
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
