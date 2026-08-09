"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { supabase } from "@/lib/supabase";
import { formatTimeAgo } from "@/utils/time-ago";
import type { User } from "@supabase/supabase-js";
import type { Message } from "@/types/messages";

export type { Message } from "@/types/messages";

export function MessageList({
  conversationId,
  initialMessages,
  user,
  registerAppend,
}: {
  conversationId: string;
  initialMessages: Message[];
  user: User | null;
  registerAppend?: (fn: (message: Message) => void) => void;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Register an append function so the parent can add a message instantly on send.
  useEffect(() => {
    if (registerAppend) {
      registerAppend((message: Message) => {
        setMessages((currentMessages) => {
          if (currentMessages.some((m) => m.id === message.id)) {
            return currentMessages;
          }
          return [...currentMessages, message];
        });
      });
    }
  }, [registerAppend]);

  useEffect(() => {
    const fetchNewMessage = async (
      messageId: string,
    ): Promise<Message | null> => {
      const { data, error } = await supabase
        .from("Message")
        .select(
          `
          id,
          body,
          createdAt,
          senderId,
          sender:User(
            id,
            name,
            handle,
            avatarUrl
          )
        `,
        )
        .eq("id", messageId)
        .single();

      if (error) {
        console.error("Error fetching new message:", error);
        return null;
      }
      const messageData = data as unknown as {
        id: string;
        body: string;
        createdAt: Date | string;
        senderId: string;
        sender: Message["sender"] | Message["sender"][];
      };
      return {
        ...messageData,
        sender: Array.isArray(messageData.sender)
          ? messageData.sender[0]
          : messageData.sender,
      } as Message;
    };

    const channel = supabase
      .channel(`realtime:messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Message",
          filter: `conversationId=eq.${conversationId}`,
        },
        async (payload) => {
          const newMessageId = (payload.new as { id: string }).id;
          const fetchedMessage = await fetchNewMessage(newMessageId);

          if (fetchedMessage) {
            setMessages((currentMessages) => {
              // Guard against duplicate inserts (e.g. replayed events).
              if (currentMessages.some((m) => m.id === fetchedMessage.id)) {
                return currentMessages;
              }
              return [...currentMessages, fetchedMessage];
            });
          }
        },
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") {
          console.warn(
            `Realtime channel status for conversation ${conversationId}: ${status}`,
          );
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  if (!user) {
    return null;
  }

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex items-start gap-3 ${
            message.senderId === user.id ? "flex-row-reverse" : ""
          }`}
        >
          <div
            className={`h-8 w-8 shrink-0 rounded-full bg-slate-200 ${
              message.senderId === user.id ? "hidden" : ""
            }`}
          >
            {message.sender.avatarUrl ? (
              <Image
                src={message.sender.avatarUrl}
                alt={message.sender.name || "Scholar"}
                width={32}
                height={32}
                unoptimized
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-500">
                {message.sender.name?.charAt(0).toUpperCase() || "@"}
              </div>
            )}
          </div>
          <div
            className={`max-w-[75%] rounded-lg px-4 py-2 ${
              message.senderId === user.id
                ? "bg-blue-500 text-white"
                : "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            <p className="text-sm">{message.body}</p>
            <p
              className={`mt-1 text-right text-[10px] ${
                message.senderId === user.id
                  ? "text-blue-200"
                  : "text-slate-400 dark:text-slate-500"
              }`}
            >
              {formatTimeAgo(message.createdAt)}
            </p>
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
}
