"use client";

import React, {
  useEffect,
  useState,
  useContext,
  useRef,
  useCallback,
} from "react";
import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { notFound } from "next/navigation";
import {
  getConversation,
  blockUser,
  unblockUser,
  markConversationAsRead,
} from "@/app/actions/messages";
import { MessageInputForm } from "@/components/messages/MessageInputForm";
import { MessageList } from "@/components/messages/MessageList";
import { supabase } from "@/utils/supabase/client";
import { Menu, MoreVertical, Ban, UserCheck } from "lucide-react";
import { MessagesLayoutContext } from "../messages-context";
import type { User } from "@supabase/supabase-js";
import type { SentMessage } from "@/components/messages/MessageInputForm";

type PresencePayload = {
  isTyping?: boolean;
  lastReadAt?: string;
};

type Participant = {
  lastReadAt: string | Date | null;
  user: {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
  };
};
type Conversation = {
  id: string;
  participants: Participant[];
  messages: SentMessage[];
};

export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = React.use(params);
  const context = useContext(MessagesLayoutContext);
  if (!context)
    throw new Error("ConversationPage must be used within a MessagesLayout");

  const { setIsSidebarOpen } = context;
  const [user, setUser] = useState<User | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [isBlocked, setIsBlocked] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);

  const [isTyping, setIsTyping] = useState(false);
  const [isOnline, setIsOnline] = useState(false);
  const lastTypedAt = useRef<number>(0);
  const roomRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [otherParticipantLastReadAt, setOtherParticipantLastReadAt] =
    useState<Date>(new Date(0));

  const appendMessageRef = useRef<((msg: SentMessage) => void) | null>(null);
  const handleAppendMessage = useCallback((fn: (msg: SentMessage) => void) => {
    appendMessageRef.current = fn;
  }, []);

  const userId = user?.id;
  const hasMarkedReadRef = useRef(false);

  // ⚡ Throttled read-marker: only hits the database server once unless forced by a new message
  const triggerMarkRead = useCallback(
    (force = false) => {
      if (!userId) return;
      if (!hasMarkedReadRef.current || force) {
        hasMarkedReadRef.current = true;
        markConversationAsRead(conversationId);
      }
      if (roomRef.current) {
        roomRef.current
          .track({
            isTyping: false,
            lastReadAt: new Date().toISOString(),
          })
          .catch(() => {});
      }
    },
    [userId, conversationId],
  );

  // Stable ref to avoid re-running effects when callback identity changes
  const triggerMarkReadRef = useRef(triggerMarkRead);
  useEffect(() => {
    triggerMarkReadRef.current = triggerMarkRead;
  }, [triggerMarkRead]);

  const handleMessageSent = useCallback(
    (message: SentMessage) => {
      appendMessageRef.current?.(message);
      triggerMarkRead(true);
      window.dispatchEvent(
        new CustomEvent("message-sent", {
          detail: { conversationId, message },
        }),
      );
    },
    [triggerMarkRead, conversationId],
  );

  // Initial fetch on mount only
  useEffect(() => {
    let isMounted = true;
    const fetchUserAndConversation = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (isMounted) {
        setUser(user);
        if (user) {
          const conv = await getConversation(conversationId, user.id);
          if (!conv) notFound();
          setConversation(conv as unknown as Conversation);

          await markConversationAsRead(conversationId);

          const currentParticipant = (conv as unknown as Conversation).participants.find(
            (p) => p.user.id === user.id,
          );
          const unreadDelta = (conv as unknown as Conversation).messages.filter(
            (m) => m.senderId !== user.id && new Date(m.createdAt) > new Date(currentParticipant?.lastReadAt || 0),
          ).length;

          window.dispatchEvent(new CustomEvent('conversation-read', {
            detail: { conversationId, userId: user.id, delta: unreadDelta }
          }));

          const otherP = (conv as unknown as Conversation).participants.find(
            (p) => p.user.id !== user.id,
          );
          if (otherP?.lastReadAt) {
            setOtherParticipantLastReadAt(new Date(otherP.lastReadAt));
          }
        } else {
          notFound();
        }
      }
    };
    fetchUserAndConversation();
    return () => {
      isMounted = false;
    };
  }, [conversationId]);

  const otherParticipantData = conversation?.participants.find(
    (p) => p.user.id !== userId,
  );
  const otherParticipant = otherParticipantData?.user;

  useEffect(() => {
    if (!isTyping) return;
    const timer = setTimeout(() => setIsTyping(false), 3000);
    return () => clearTimeout(timer);
  }, [isTyping]);

  // Stable Presence & Read Sync Channel
  useEffect(() => {
    if (!userId || !conversationId) return;

    const room = supabase.channel(`presence-${conversationId}`, {
      config: { presence: { key: userId } },
    });

    roomRef.current = room;

    room
      .on("presence", { event: "sync" }, () => {
        const state = room.presenceState();
        const otherUserId = otherParticipant?.id;

        if (otherUserId && state[otherUserId]) {
          setIsOnline(true);
          const presencePayload = state[otherUserId][0] as PresencePayload;
          setIsTyping(presencePayload?.isTyping || false);

          if (presencePayload?.lastReadAt) {
            setOtherParticipantLastReadAt(new Date(presencePayload.lastReadAt));
          }
        } else {
          setIsOnline(false);
          setIsTyping(false);
        }
      })
      .subscribe(async (status: string) => {
        if (status === "SUBSCRIBED") {
          await room.track({
            isTyping: false,
            lastReadAt: new Date().toISOString(),
          });
        }
      });

    const handleVisibilityChange = () => {
      if (document.hidden) {
        room.untrack();
        setIsOnline(false);
      } else {
        triggerMarkReadRef.current();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      supabase.removeChannel(room);
      roomRef.current = null;
    };
  }, [userId, conversationId, otherParticipant?.id]);

  const broadcastTyping = useCallback(() => {
    if (!userId || !roomRef.current) return;
    const now = Date.now();
    if (now - lastTypedAt.current >= 1200) {
      lastTypedAt.current = now;

      roomRef.current
        .track({
          isTyping: true,
          lastReadAt: new Date().toISOString(),
        })
        .catch(() => {});
    }

    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      roomRef.current
        ?.track({
          isTyping: false,
          lastReadAt: new Date().toISOString(),
        })
        .catch(() => {});
    }, 1800);
  }, [userId]);

  // Stable callback to avoid re-subscribing realtime channel
  const onMessageReceived = useCallback(() => {
    triggerMarkRead(true);
  }, [triggerMarkRead]);

  // Stable ref for broadcastTyping to avoid resetting typing timeout
  const broadcastTypingRef = useRef(broadcastTyping);
  useEffect(() => {
    broadcastTypingRef.current = broadcastTyping;
  }, [broadcastTyping]);

  useEffect(() => {
    const closeOnOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-block-menu]")) setMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  if (!user || !conversation) {
    return (
      <div className="flex flex-col h-full items-center justify-center text-slate-500">
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
          className="mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 shadow-sm backdrop-blur-sm md:hidden dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300"
        >
          <Menu className="h-6 w-6" />
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <Link
            href={otherParticipant ? `/scholars/${otherParticipant.id}` : "#"}
            className="flex shrink-0 items-center gap-3"
          >
            <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200 dark:bg-slate-800">
              {otherParticipant?.avatarUrl ? (
                <UserAvatar
                  src={otherParticipant.avatarUrl}
                  name={otherParticipant?.name}
                  imageClassName="rounded-full"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-500">
                  {otherParticipant?.name?.charAt(0).toUpperCase() || "@"}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h1 className="truncate font-semibold text-slate-900 dark:text-slate-100">
                {otherParticipant?.name || "Scholar"}
              </h1>
              <p className="truncate text-sm text-slate-500 dark:text-slate-400">
                {isTyping ? (
                  <span className="text-blue-500 font-medium italic">
                    typing...
                  </span>
                ) : isOnline ? (
                  <span className="text-green-500 font-medium">Online</span>
                ) : otherParticipant?.handle ? (
                  `@${otherParticipant.handle}`
                ) : (
                  "scholar"
                )}
              </p>
            </div>
          </Link>
        </div>
        <div className="relative" data-block-menu>
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300"
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-12 z-20 w-56 origin-top-right rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
              <button
                onClick={handleToggleBlock}
                disabled={isBlocking}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-500/10"
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
          otherParticipantLastReadAt={otherParticipantLastReadAt}
          registerAppend={handleAppendMessage}
          onMessageReceived={onMessageReceived}
        />
      </div>

      <MessageInputForm
        conversationId={conversation.id}
        onMessageSent={handleMessageSent}
        currentUser={user}
        onTyping={broadcastTyping}
      />
    </div>
  );
}
