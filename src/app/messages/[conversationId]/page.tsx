"use client";

import React, { useEffect, useState, useContext, use, useRef } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getConversation,
  isUserBlocked,
  blockUser,
  unblockUser,
} from "@/app/actions/messages";
import { MessageInputForm } from "@/components/messages/MessageInputForm";
import { MessageList } from "@/components/messages/MessageList";
import { createClient } from "@/utils/supabase/client";
import { Menu, MoreVertical, Ban, UserCheck } from "lucide-react";
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
  createdAt: Date | string;
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
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = use(params);
  const context = useContext(MessagesLayoutContext);
  if (!context) {
    throw new Error("ConversationPage must be used within a MessagesLayout");
  }
  const { setIsSidebarOpen } = context;
  const [user, setUser] = useState<User | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const appendMessageRef = useRef<((msg: Message) => void) | null>(null);

  useEffect(() => {
    const supabase = createClient();
    const fetchUserAndConversation = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
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

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        const conv = await getConversation(conversationId, session.user.id);
        if (!conv) {
          notFound();
        }
        setConversation(conv as Conversation);
      }
    });

    return () => subscription.unsubscribe();
  }, [conversationId]);

  const otherParticipant = conversation?.participants.find(
    (p) => p.user.id !== user?.id,
  )?.user;

  useEffect(() => {
    if (user && otherParticipant) {
      isUserBlocked(user.id, otherParticipant.id).then(setIsBlocked);
    }
  }, [user, otherParticipant]);

  useEffect(() => {
    const closeOnOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-block-menu]")) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  if (!user || !conversation) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-slate-500 dark:text-slate-400">
        Loading conversation...
      </div>
    );
  }

  const handleToggleBlock = async () => {
    if (!otherParticipant || isBlocking) return;
    setIsBlocking(true);
    setMenuOpen(false);
    try {
      if (isBlocked) {
        await unblockUser(otherParticipant.id);
        setIsBlocked(false);
      } else {
        await blockUser(otherParticipant.id);
        setIsBlocked(true);
      }
    } catch (err) {
      console.error("Failed to update block status:", err);
    } finally {
      setIsBlocking(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-4 dark:border-slate-800">
        <button
          type="button"
          onClick={() => setIsSidebarOpen(true)}
          className="mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 shadow-sm backdrop-blur-sm transition hover:bg-white md:hidden dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300"
          aria-label="Toggle conversation sidebar"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
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
        <div className="relative" data-block-menu>
          <button
            type="button"
            onClick={() => setMenuOpen((open) => !open)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 shadow-sm transition hover:bg-white dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300 dark:hover:bg-slate-800"
            aria-label="Conversation options"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 z-20 w-56 origin-top-right rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <button
                type="button"
                onClick={handleToggleBlock}
                disabled={isBlocking}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
              >
                {isBlocked ? (
                  <UserCheck className="h-4 w-4" />
                ) : (
                  <Ban className="h-4 w-4" />
                )}
                {isBlocking
                  ? "Processing..."
                  : isBlocked
                    ? "Unblock scholar"
                    : "Block scholar"}
              </button>
            </div>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <MessageList
          conversationId={conversation.id}
          initialMessages={conversation.messages}
          user={user}
          registerAppend={(fn) => {
            appendMessageRef.current = fn;
          }}
        />
      </div>
      <MessageInputForm
        conversationId={conversation.id}
        onMessageSent={(message) => {
          appendMessageRef.current?.(message);
        }}
      />
    </div>
  );
}
