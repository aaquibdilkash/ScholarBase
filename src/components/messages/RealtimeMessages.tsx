"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { supabase } from "@/utils/supabase/client";
import { formatTimeAgo } from "@/utils/time-ago";
import type { User } from "@supabase/supabase-js";
import { Message } from "@/types/messages";

type RealtimeMessagesProps = {
  initialMessages: Message[];
  conversationId: string;
  currentUser: User;
};

export function RealtimeMessages({
  initialMessages,
  conversationId,
  currentUser,
}: RealtimeMessagesProps) {
  const [messages, setMessages] = useState(initialMessages);

  useEffect(() => {
    // Scroll to the bottom on initial render
    window.scrollTo(0, document.body.scrollHeight);
  }, []);

  useEffect(() => {
    setMessages(initialMessages);
  }, [initialMessages]);

  useEffect(() => {
    const channel = supabase
      .channel(`realtime-messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "Message",
          filter: `conversationId=eq.${conversationId}`,
        },
        async (payload) => {
          // The payload.new will contain the new message, but it won't have the sender's details.
          // We need to fetch the full message details.
          // This is a simplification. In a real app, you might want to fetch the sender details separately
          // or have a more complex payload from the database.

          // For now, let's assume we can get sender info from the existing messages or make a quick fetch.
          // This is not ideal because it makes an extra DB call for each new message.
          // A better approach would be to use Supabase database functions to enrich the payload.

          const newMessage = payload.new as Omit<Message, "sender">;

          // Let's find a sender from the existing participants if possible to avoid a fetch.
          // This is a placeholder logic. You'll need to adapt it.
          // In a 1-on-1 chat, we can find the sender if it's not the current user.
          // A more robust way is to join the sender data in the backend.

          // This is a simplified example of enriching the data client-side.
          // A better way would be to get the sender details from the server.
          // However, for a quick implementation, this will work.

          // We can't just fetch from prisma here since we are on the client.
          // The best we can do is to make an API call or, for now, just refetch all messages.
          // Refetching all messages is inefficient but simple to implement right now.

          // Let's try a more optimistic update with the data we have
          // We'll need to fetch the sender details.
          // A proper implementation would have an API endpoint for that or use DB functions.

          // Let's just add the message with a placeholder for the sender for now
          // and then figure out how to get the sender's data.

          const { data: senderData, error } = await supabase
            .from("User")
            .select("id, name, handle, avatarUrl")
            .eq("id", newMessage.senderId)
            .single();

          if (error) {
            console.error("Error fetching sender:", error);
            // Handle error, maybe refetch all messages
            return;
          }

          const fullMessage: Message = {
            ...newMessage,
            createdAt: newMessage.createdAt.toString(),
            sender: senderData,
          };

          setMessages((currentMessages) => [...currentMessages, fullMessage]);

          // Scroll to the bottom when a new message arrives
          window.scrollTo(0, document.body.scrollHeight);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

  return (
    <div className="space-y-6">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex items-end gap-3 ${
            message.senderId === currentUser.id ? "flex-row-reverse" : ""
          }`}
        >
          <div
            className={`h-8 w-8 shrink-0 rounded-full bg-slate-900 dark:bg-slate-800 ${
              message.senderId === currentUser.id ? "hidden" : ""
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
              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-white dark:text-slate-300">
                {message.sender.name?.charAt(0).toUpperCase() || "@"}
              </div>
            )}
          </div>
          <div
            className={`max-w-[70%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
              message.senderId === currentUser.id
                ? "rounded-br-none bg-blue-600 text-white dark:bg-blue-700"
                : "rounded-bl-none bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200"
            }`}
          >
            <p>{message.body}</p>
            <p
              className={`mt-1 text-[10px] ${
                message.senderId === currentUser.id
                  ? "text-slate-400"
                  : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {formatTimeAgo(new Date(message.createdAt))}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
