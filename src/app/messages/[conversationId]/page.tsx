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
import { usePresence } from "@/components/interactions/PresenceProvider";
import { Menu, MoreVertical, Ban, UserCheck, Loader2, Flag } from "lucide-react";
import { MessagesLayoutContext } from "../messages-context";
import { useToast } from "@/components/ui/Toast";
import { ReportModal } from "@/components/cards/ReportModal";
import type { User } from "@supabase/supabase-js";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import type { SentMessage } from "@/components/messages/MessageInputForm";

type TypingPayload = {
  userId?: string;
  isTyping?: boolean;
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
  blockedByMe?: boolean;
  blockedMe?: boolean;
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
  const [blockState, setBlockState] = useState({
    blockedByMe: false,
    blockedMe: false,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const { toast } = useToast();

  const [isTyping, setIsTyping] = useState(false);
  const lastTypedAt = useRef<number>(0);
  const roomRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingClearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [otherParticipantLastReadAt, setOtherParticipantLastReadAt] =
    useState<Date>(new Date(0));

  const appendMessageRef = useRef<((msg: SentMessage) => void) | null>(null);
  const handleAppendMessage = useCallback((fn: (msg: SentMessage) => void) => {
    appendMessageRef.current = fn;
  }, []);

  // ⚡ ISSUE 4: MessageList registers a handler that receives failed sends so
  // they can be merged into the visible thread with a Retry affordance.
  const addFailedMessageRef = useRef<((msg: SentMessage) => void) | null>(null);
  const handleRegisterAddFailed = useCallback(
    (fn: (msg: SentMessage) => void) => {
      addFailedMessageRef.current = fn;
    },
    [],
  );
  const handleMessageFailed = useCallback((message: SentMessage) => {
    addFailedMessageRef.current?.(message);
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
          // ⚡ ISSUE 5: Hydrate block state so the composer is disabled and the
          // correct notice banner renders on load.
          setBlockState({
            blockedByMe: Boolean((conv as Conversation).blockedByMe),
            blockedMe: Boolean((conv as Conversation).blockedMe),
          });

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

  // ⚡ Online status comes from the centralized global presence channel.
  const { onlineUserIds } = usePresence();
  const isOtherOnline = otherParticipant
    ? onlineUserIds.has(otherParticipant.id)
    : false;

  // Stable ref for the other participant so the realtime effect below does not
  // re-subscribe every time the conversation object is set.
  const otherUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    otherUserIdRef.current = otherParticipant?.id ?? null;
  }, [otherParticipant?.id]);

  useEffect(() => {
    if (!isTyping) return;
    const timer = setTimeout(() => setIsTyping(false), 3000);
    return () => clearTimeout(timer);
  }, [isTyping]);

  // ⚡ ISSUE 3: Scoped realtime channel for this conversation.
  //  - Typing: broadcast events (debounced, self-filtered, auto-clear).
  //  - Read receipts: Postgres Changes on ConversationParticipant — reliable
  //    and independent of presence heartbeats.
  //  - Online status: global `presence:global` channel (PresenceProvider).
  // Full teardown on conversation switch prevents stale-channel leaks.
  useEffect(() => {
    if (!userId || !conversationId) return;

    const channel = supabase.channel(`conversation:${conversationId}`, {
      config: { broadcast: { self: false } },
    });
    roomRef.current = channel;

    channel
      .on(
        "broadcast",
        { event: "typing" },
        ({ payload }: { payload: TypingPayload }) => {
          if (!payload || payload.userId === userId) return;
          if (payload.isTyping) {
            setIsTyping(true);
            if (typingClearTimerRef.current)
              clearTimeout(typingClearTimerRef.current);
            typingClearTimerRef.current = setTimeout(
              () => setIsTyping(false),
              3000,
            );
          } else {
            setIsTyping(false);
          }
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "ConversationParticipant",
        },
        (
          payload: RealtimePostgresChangesPayload<{
            conversationId: string;
            userId: string;
            lastReadAt: string | null;
          }>,
        ) => {
          const row = payload.new as {
            conversationId: string;
            userId: string;
            lastReadAt: string | null;
          };
          if (row.conversationId !== conversationId) return;
          if (
            row.userId === otherUserIdRef.current &&
            row.userId !== userId &&
            row.lastReadAt
          ) {
            setOtherParticipantLastReadAt(new Date(row.lastReadAt));
          }
        },
      )
      .subscribe();

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Resynchronize read state when the tab wakes up.
        triggerMarkReadRef.current();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      if (typingClearTimerRef.current) clearTimeout(typingClearTimerRef.current);
      supabase.removeChannel(channel);
      roomRef.current = null;
    };
  }, [userId, conversationId]);

  const broadcastTyping = useCallback(() => {
    if (!userId || !roomRef.current) return;
    const now = Date.now();
    // ⚡ Debounce: emit TYPING_START at most once every 2 seconds.
    if (now - lastTypedAt.current >= 2000) {
      lastTypedAt.current = now;
      roomRef.current
        .send({
          type: "broadcast",
          event: "typing",
          payload: { userId, isTyping: true } satisfies TypingPayload,
        })
        .catch(() => {});
    }

    // ⚡ Automatically emit TYPING_STOP after 3 seconds of inactivity.
    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      roomRef.current
        ?.send({
          type: "broadcast",
          event: "typing",
          payload: { userId, isTyping: false } satisfies TypingPayload,
        })
        .catch(() => {});
    }, 3000);
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
      <div className="flex flex-col h-full items-center justify-center gap-3 text-slate-500">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm font-semibold">Loading conversation...</p>
      </div>
    );
  }

  const handleToggleBlock = async () => {
    if (!otherParticipant || isBlocking) return;
    setIsBlocking(true);
    // ⚡ Keep the dropdown open while the spinner is visible — close it only
    // once the block/unblock action settles.
    // setMenuOpen(false);  <-- intentionally removed
    try {
      if (blockState.blockedByMe) {
        await unblockUser(otherParticipant.id);
        setBlockState((s) => ({ ...s, blockedByMe: false }));
        toast(`${otherParticipant.name || "Scholar"} unblocked. You can message them again.`, "default");
      } else {
        await blockUser(otherParticipant.id);
        setBlockState((s) => ({ ...s, blockedByMe: true }));
        toast(`${otherParticipant.name || "Scholar"} blocked. They can no longer message you.`, "default");
      }
    } catch (err) {
      console.error("Failed to update block status:", err);
      toast(
        err instanceof Error ? err.message : "Failed to update block status.",
        "error",
      );
    } finally {
      setIsBlocking(false);
      setMenuOpen(false);
    }
  };

  // ⚡ ISSUE 5: A block in either direction disables the composer.
  const isChatDisabled = blockState.blockedByMe || blockState.blockedMe;

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
                ) : isOtherOnline ? (
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
                {isBlocking ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : blockState.blockedByMe ? (
                  <UserCheck className="h-4 w-4" />
                ) : (
                  <Ban className="h-4 w-4" />
                )}
                {isBlocking
                  ? "Processing..."
                  : blockState.blockedByMe
                    ? "Unblock scholar"
                    : "Block scholar"}
              </button>
              <button
                onClick={() => {
                  setMenuOpen(false);
                  setIsReportOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                <Flag className="h-4 w-4" />
                Report User
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
          registerAddFailed={handleRegisterAddFailed}
          onMessageReceived={onMessageReceived}
        />
      </div>

      {isChatDisabled && (
        <div
          role="alert"
          className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
        >
          {blockState.blockedMe ? (
            <span>You cannot send messages to this scholar.</span>
          ) : (
            <>
              <span>You have blocked this scholar.</span>
              <button
                type="button"
                onClick={handleToggleBlock}
                disabled={isBlocking}
                className="inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-3.5 py-1.5 text-xs font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100 disabled:opacity-50 dark:border-amber-700 dark:bg-slate-900 dark:text-amber-300 dark:hover:bg-slate-800"
              >
                {isBlocking ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <UserCheck className="h-3.5 w-3.5" />
                    Unblock scholar
                  </>
                )}
              </button>
            </>
          )}
        </div>
      )}

      <MessageInputForm
        conversationId={conversation.id}
        onMessageSent={handleMessageSent}
        onMessageFailed={handleMessageFailed}
        currentUser={user}
        onTyping={broadcastTyping}
        isDisabled={isChatDisabled}
      />

      {otherParticipant && (
        <ReportModal
          isOpen={isReportOpen}
          onClose={() => setIsReportOpen(false)}
          entityId={otherParticipant.id}
          entityType="POST"
          module="SCHOLAR_PROFILE"
        />
      )}
    </div>
  );
}
