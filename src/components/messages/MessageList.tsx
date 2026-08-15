"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { supabase } from "@/utils/supabase/client";
import { getMessageDetails, getMoreMessages } from "@/app/actions/messages";
import { MessageItem } from "./MessageItem";
import type { User } from "@supabase/supabase-js";
import type { SentMessage } from "./MessageInputForm";
type MessageRow = {
  id: string;
  conversationId?: string;
  conversation_id?: string;
  body: string;
  senderId?: string;
  createdAt: string;
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
  onMessageReceived,
}: {
  conversationId: string;
  initialMessages: SentMessage[];
  user: User | null;
  otherParticipantLastReadAt: Date;
  registerAppend?: (fn: (message: SentMessage) => void) => void;
  onMessageReceived?: () => void;
}) {
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
                m.status === "sending" &&
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
          // Replace any temporary optimistic "sending" message with the real one
          const filtered = current.filter(
            (m) =>
              !(
                m.status === "sending" &&
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

    channel
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "Message" },
        handleInsert,
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
        />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
