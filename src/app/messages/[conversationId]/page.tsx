"use client";

import React, { useEffect, useState, useContext } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getConversation } from "@/app/actions/messages";
import { MessageInputForm } from "@/components/messages/MessageInputForm";
import { MessageList } from "@/components/messages/MessageList";
import { createClient } from "@/utils/supabase/client";
import { Menu } from "lucide-react";
import { MessagesLayoutContext } from "../messages-context";
import type { User } from "@supabase/supabase-js";

// Define necessary types
type Participant = {
  user: {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
  };
};

type Message = {
  id: string;
  body: string;
  createdAt: Date;
  senderId: string;
  sender: {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
  };
};

type Conversation = {
  id: string;
  participants: Participant[];
  messages: Message[];
};


export default function ConversationPage({
  params,
}: {
  params: { conversationId: string };
}) {
  const { conversationId } = params;
  const context = useContext(MessagesLayoutContext);
  if (!context) {
    throw new Error("ConversationPage must be used within a MessagesLayout");
  }
  const { setMobileOpen } = context;
  const [user, setUser] = useState<User | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const fetchUserAndConversation = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
      if (user) {
        const conv = await getConversation(conversationId, user.id);
        if (!conv) {
          notFound();
        }
        setConversation(conv as Conversation);
      } else {
        notFound();
      }
    };

    fetchUserAndConversation();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          const conv = await getConversation(conversationId, session.user.id);
          if (!conv) {
            notFound();
          }
          setConversation(conv as Conversation);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [conversationId]);

  if (!user || !conversation) {
    return <div className="flex flex-col h-full items-center justify-center text-slate-500 dark:text-slate-400">Loading conversation...</div>;
  }

  const otherParticipant = conversation.participants.find(
    (p) => p.user.id !== user.id,
  )?.user;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-4 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white md:hidden dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300"
          aria-label="Toggle conversation sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href={otherParticipant ? `/scholars/${otherParticipant.id}` : "#"}
            className="flex shrink-0 items-center gap-3 transition-opacity hover:opacity-80"
            title={
              otherParticipant
                ? `View ${otherParticipant.name || "this scholar"}'s profile`
                : "Scholar profile"
            }
          >
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200 dark:bg-slate-800">
              {otherParticipant?.avatarUrl ? (
                <img
                  src={otherParticipant.avatarUrl}
                  alt={otherParticipant.name || "Scholar"}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                  {otherParticipant?.name?.charAt(0).toUpperCase() || "@"}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-semibold text-slate-900 dark:text-slate-100">
                {otherParticipant?.name || "Scholar"}
              </h1>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                {otherParticipant?.handle
                  ? `@${otherParticipant.handle}`
                  : "scholar"}
              </p>
            </div>
          </Link>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <MessageList
          conversationId={conversation.id}
          initialMessages={conversation.messages}
          user={user}
        />
      </div>
      <MessageInputForm conversationId={conversation.id} />
    </div>
  );
}
