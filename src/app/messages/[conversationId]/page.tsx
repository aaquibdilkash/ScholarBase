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
import { useRouter } from "next/navigation";
import {
  getConversation,
  blockUser,
  unblockUser,
  markConversationAsRead,
  removeGroupParticipant,
} from "@/app/actions/messages";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { MessageInputForm } from "@/components/messages/MessageInputForm";
import { MessageList } from "@/components/messages/MessageList";
import { supabase } from "@/utils/supabase/client";
import { usePresence } from "@/components/interactions/PresenceProvider";
import { useIsFrozen } from "@/components/interactions/FrozenUserProvider";
import {
  MoreVertical,
  Ban,
  UserCheck,
  Loader2,
  Flag,
  ChevronsLeft,
  ChevronsRight,
  LogOut,
  Users,
} from "lucide-react";
import { MessagesLayoutContext } from "../messages-context";
import { useToast } from "@/components/ui/Toast";
import { actionErrorMessage } from "@/lib/utils";
import { ReportModal } from "@/components/cards/ReportModal";
import { GroupInfoPanel } from "@/components/messages/GroupInfoPanel";
import { FrozenContentBanner } from "@/components/moderation/FrozenContentBanner";
import type { User, RealtimeChannel } from "@supabase/supabase-js";
import type { SentMessage } from "@/components/messages/MessageInputForm";
import type { MessageFailureCode } from "@/app/actions/messages";
import { conversationTopic, privateChannel } from "@/lib/realtime";

type TypingPayload = {
  userId?: string;
  isTyping?: boolean;
};

type ReadReceiptPayload = {
  userId: string;
  lastReadAt: string;
};

type Participant = {
  lastReadAt: string | Date | null;
  role: "OWNER" | "MEMBER";
  user: {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
    isFrozen?: boolean;
    isDeleted?: boolean;
  };
};
type Conversation = {
  id: string;
  type: "DIRECT" | "GROUP";
  title: string | null;
  contextType: string | null;
  contextId: string | null;
  participants: Participant[];
  messages: SentMessage[];
  blockedByMe?: boolean;
  blockedMe?: boolean;
  /** Group moderation state — a frozen group is read-only. */
  isFrozen?: boolean;
  hasActiveAppeal?: boolean;
  createdById?: string;
};

export default function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = React.use(params);
  const router = useRouter();
  const context = useContext(MessagesLayoutContext);
  if (!context)
    throw new Error("ConversationPage must be used within a MessagesLayout");

  const { isSidebarOpen, setIsSidebarOpen } = context;
  const [user, setUser] = useState<User | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const conversationTypeRef = useRef<Conversation["type"]>("DIRECT");
  const [blockState, setBlockState] = useState({
    blockedByMe: false,
    blockedMe: false,
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const [groupMenuOpen, setGroupMenuOpen] = useState(false);
  const [isGroupInfoOpen, setIsGroupInfoOpen] = useState(false);
  const [groupReportOpen, setGroupReportOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);
  const [isBlocking, setIsBlocking] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  // ⚡ QUOTE REPLY: The message currently being replied to (WhatsApp-style).
  const [replyingTo, setReplyingTo] = useState<SentMessage | null>(null);
  const { toast } = useToast();
  const isCurrentUserFrozen = useIsFrozen();

  const [isTyping, setIsTyping] = useState(false);
  const [typingUserIds, setTypingUserIds] = useState<Set<string>>(new Set());
  const [groupReadAt, setGroupReadAt] = useState<Record<string, number>>({});
  const lastTypedAt = useRef<number>(0);
  const roomRef = useRef<RealtimeChannel | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const [otherParticipantLastReadAt, setOtherParticipantLastReadAt] =
    useState<Date>(new Date(0));

  const updateOtherParticipantLastReadAt = useCallback((next: Date) => {
    setOtherParticipantLastReadAt((current) =>
      next.getTime() > current.getTime() ? next : current,
    );
  }, []);

  const appendMessageRef = useRef<
    ((msg: SentMessage, replacesId?: string) => void) | null
  >(null);
  const handleAppendMessage = useCallback(
    (fn: (msg: SentMessage, replacesId?: string) => void) => {
      appendMessageRef.current = fn;
    },
    [],
  );

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

  // ⚡ EDITS + TOMBSTONES: MessageList registers a handler for the Realtime
  // `UPDATE` broadcast, so this page can push a remote edit into the thread
  // without MessageList owning a channel of its own.
  const updateMessageRef = useRef<((msg: SentMessage) => void) | null>(null);
  const handleRegisterUpdate = useCallback(
    (fn: (msg: SentMessage) => void) => {
      updateMessageRef.current = fn;
    },
    [],
  );

  const handleMessageRejected = useCallback((code: MessageFailureCode) => {
    if (code === "BLOCKED") {
      setBlockState((state) => ({ ...state, blockedByMe: true }));
    }
  }, []);

  const userId = user?.id;
  const hasMarkedReadRef = useRef(false);
  const lastReadAtRef = useRef<Date | null>(null);

  const broadcastReadReceipt = useCallback(
    (lastReadAt: Date) => {
      if (!userId || !roomRef.current) return;
      roomRef.current
        .send({
          type: "broadcast",
          event: "read-receipt",
          payload: {
            userId,
            lastReadAt: lastReadAt.toISOString(),
          } satisfies ReadReceiptPayload,
        })
        .catch(() => {});
    },
    [userId],
  );

  // ⚡ Throttled read-marker: only hits the database server once unless forced by a new message
  const triggerMarkRead = useCallback(
    (force = false) => {
      if (!userId) return;
      if (!hasMarkedReadRef.current || force) {
        hasMarkedReadRef.current = true;
        void markConversationAsRead(conversationId).then((result) => {
          if (!result?.lastReadAt) return;
          const lastReadAt = new Date(result.lastReadAt);
          lastReadAtRef.current = lastReadAt;
          broadcastReadReceipt(lastReadAt);
        }).catch((error) => {
          // Allow a later retry instead of an unhandled rejection.
          hasMarkedReadRef.current = false;
          console.error("Failed to mark conversation as read:", error);
        });
      }
    },
    [userId, conversationId, broadcastReadReceipt],
  );

  // Stable ref to avoid re-running effects when callback identity changes
  const triggerMarkReadRef = useRef(triggerMarkRead);
  useEffect(() => {
    triggerMarkReadRef.current = triggerMarkRead;
  }, [triggerMarkRead]);

  // ⚡ RECONNECT CATCH-UP: merges the newest server page into the thread after
  // the channel re-joins. Broadcast is fire-and-forget, so everything sent
  // while the socket was down was lost and only a refresh brought it back.
  const syncLatestRef = useRef<((rows: SentMessage[]) => boolean) | null>(null);
  const handleRegisterSyncLatest = useCallback(
    (fn: (rows: SentMessage[]) => boolean) => {
      syncLatestRef.current = fn;
    },
    [],
  );
  const catchUpLatestMessages = useCallback(() => {
    void getConversation(conversationId)
      .then((fresh) => {
        if (!fresh || fresh.messages.length === 0) return;
        const rows = [...fresh.messages]
          .reverse()
          .map((message) => ({ ...message, status: "sent" as const }));
        if (syncLatestRef.current?.(rows)) {
          // The reader is looking at the thread, so anything newly merged is
          // already read.
          triggerMarkReadRef.current(true);
        }
      })
      .catch((error) => {
        console.error("Failed to catch up on missed messages:", error);
      });
  }, [conversationId]);

  const handleMessageSent = useCallback(
    (message: SentMessage, replacesId?: string) => {
      appendMessageRef.current?.(message, replacesId);
      triggerMarkRead(true);

      // ⚡ NO client-side broadcast here. The `Message` AFTER INSERT trigger
      // (supabase/realtime/broadcast-messages.sql) already publishes the
      // confirmed row to this conversation's private topic. The client-sent
      // copy that used to live here would have delivered every message twice.
      window.dispatchEvent(
        new CustomEvent("message-sent", {
          detail: { conversationId, message },
        }),
      );
    },
    [triggerMarkRead, conversationId],
  );

  // ⚡ Incoming message. The trigger sends the fully-populated row (sender and
  // replyTo included), so this no longer calls `getMessageDetails`. Appends go
  // through MessageList's registerAppend, which already reconciles a matching
  // optimistic bubble by body + sender when Realtime beats the server action.
  const handleBroadcastMessage = useCallback(
    (message: SentMessage) => {
      if (!userId || message.senderId === userId) return;
      appendMessageRef.current?.({ ...message, status: "sent" });
      triggerMarkRead(true);
      window.dispatchEvent(
        new CustomEvent("message-received", {
          detail: { conversationId, message },
        }),
      );
    },
    [conversationId, triggerMarkRead, userId],
  );

  // Reconcile edits and tombstones on every connected device, including the
  // author's own, so optimistic state always converges with the server.
  const handleBroadcastUpdate = useCallback(
    (message: SentMessage) => {
      updateMessageRef.current?.({ ...message, status: "sent" });
    },
    [],
  );

  // Initial fetch on mount only
  useEffect(() => {
    let isMounted = true;
    const fetchUserAndConversation = async () => {
      const [authResult, conv] = await Promise.all([
        supabase.auth.getUser(),
        getConversation(conversationId),
      ]);

      if (!isMounted) return;

      const user = authResult.data.user;
      setUser(user);
      if (!user) {
        router.replace("/not-found");
        return;
      }

      if (!conv) {
        router.replace("/not-found");
        return;
      }

      setConversation(conv as unknown as Conversation);
      conversationTypeRef.current = (conv as unknown as Conversation).type;
      setBlockState({
        blockedByMe: Boolean((conv as Conversation).blockedByMe),
        blockedMe: Boolean((conv as Conversation).blockedMe),
      });

      // A failed read-marker must never break loading the conversation.
      const readResult = await markConversationAsRead(conversationId).catch(
        (error) => {
          console.error("Failed to mark conversation as read:", error);
          return undefined;
        },
      );

      hasMarkedReadRef.current = true;
      if (readResult?.lastReadAt) {
        lastReadAtRef.current = new Date(readResult.lastReadAt);
      }

      const currentParticipant = (
        conv as unknown as Conversation
      ).participants.find((p) => p.user.id === user.id);
      const unreadDelta = (conv as unknown as Conversation).messages.filter(
        (m) =>
          m.senderId !== user.id &&
          new Date(m.createdAt) > new Date(currentParticipant?.lastReadAt || 0),
      ).length;

      window.dispatchEvent(
        new CustomEvent("conversation-read", {
          detail: { conversationId, userId: user.id, delta: unreadDelta },
        }),
      );

      const otherP = (conv as unknown as Conversation).participants.find(
        (p) => p.user.id !== user.id,
      );
      if (otherP?.lastReadAt) {
        setOtherParticipantLastReadAt(new Date(otherP.lastReadAt));
      }
      if ((conv as unknown as Conversation).type === "GROUP") {
        const reads: Record<string, number> = {};
        for (const participant of (conv as unknown as Conversation).participants) {
          if (participant.user.id !== user.id) {
            reads[participant.user.id] = participant.lastReadAt
              ? new Date(participant.lastReadAt).getTime()
              : 0;
          }
        }
        setGroupReadAt(reads);
      }
    };

    void fetchUserAndConversation();
    return () => {
      isMounted = false;
    };
  }, [conversationId, router]);

  const otherParticipantData = conversation?.participants.find(
    (p) => p.user.id !== userId,
  );
  const otherParticipant = otherParticipantData?.user;
  const isGroup = conversation?.type === "GROUP";

  // A reply target belongs to one conversation. Switching threads must clear it
  // so the composer does not quote a message from the previous thread (and send
  // a `replyToId` the new conversation does not contain).
  useEffect(() => {
    setReplyingTo(null);
  }, [conversationId]);

  // ⚡ Online status comes from the centralized global presence channel.
  const { onlineUserIds } = usePresence();
  const isOtherOnline = !isGroup && otherParticipant
    ? onlineUserIds.has(otherParticipant.id)
    : false;
  const onlineGroupCount = isGroup
    ? (conversation?.participants.filter((participant) => participant.user.id !== userId && onlineUserIds.has(participant.user.id)).length ?? 0)
    : 0;
  const typingNames = isGroup
    ? [...typingUserIds].map((id) => conversation?.participants.find((participant) => participant.user.id === id)?.user.name || "Scholar")
    : [];
  const groupReadCutoff = isGroup && conversation
    ? Math.min(...conversation.participants.filter((participant) => participant.user.id !== userId).map((participant) => groupReadAt[participant.user.id] ?? 0))
    : otherParticipantLastReadAt.getTime();

  // ⚡ ONE private channel per conversation (see supabase/realtime/README.md).
  //  - Messages: Broadcast from Database. The `Message` AFTER INSERT/UPDATE
  //    trigger publishes the confirmed row here, so a message is delivered
  //    exactly once. This replaces two unfiltered `postgres_changes`
  //    subscriptions plus a client-sent `message` broadcast, which between them
  //    delivered every message three times and re-fetched it via
  //    `getMessageDetails` — one extra application invocation per receipt.
  //  - Typing / read receipts / block state: client broadcasts, debounced and
  //    self-filtered.
  //  - Online status: global `presence:global` channel (PresenceProvider).
  // Full teardown on conversation switch prevents stale-channel leaks.
  useEffect(() => {
    if (!userId || !conversationId) return;

    // `privateChannel` is async: it awaits realtime.setAuth() so the
    // `realtime.messages` policies are evaluated as the signed-in user rather
    // than as `anon`. The `cancelled` flag drops the channel if this effect is
    // torn down (conversation switch) before that promise settles.
    let channel: RealtimeChannel | null = null;
    let cancelled = false;
    let hasSubscribed = false;

    void privateChannel(conversationTopic(conversationId)).then((ch) => {
      if (cancelled) {
        void supabase.removeChannel(ch);
        return;
      }
      channel = ch;
      roomRef.current = ch;

      ch.on(
        "broadcast",
        { event: "INSERT" },
        ({ payload }: { payload: SentMessage }) => {
          if (!payload?.id) return;
          handleBroadcastMessage(payload);
        },
      )
        .on(
          "broadcast",
          { event: "UPDATE" },
          ({ payload }: { payload: SentMessage }) => {
            if (!payload?.id) return;
            handleBroadcastUpdate(payload);
          },
        )
        .on(
          "broadcast",
          { event: "CONVERSATION_BLOCKED" },
        ({
          payload,
        }: {
          payload?: { blockerId?: string; blockedId?: string };
        }) => {
          if (!payload?.blockerId || !payload.blockedId || !userId) return;
          if (payload.blockerId !== userId && payload.blockedId !== userId)
            return;
          setBlockState((state) => ({
            ...state,
            blockedByMe: payload.blockerId === userId || state.blockedByMe,
            blockedMe: payload.blockedId === userId || state.blockedMe,
          }));
          setIsTyping(false);
          toast(
            "Messaging is no longer available in this conversation.",
            "error",
          );
        },
      )
      .on(
        "broadcast",
        { event: "CONVERSATION_UNBLOCKED" },
        ({
          payload,
        }: {
          payload?: { blockerId?: string; blockedId?: string };
        }) => {
          if (!payload?.blockerId || !payload.blockedId || !userId) return;
          if (payload.blockerId !== userId && payload.blockedId !== userId)
            return;

          // Update optimistically, then re-read the authoritative state so a
          // second block in the opposite direction is still respected.
          setBlockState((state) => ({
            ...state,
            blockedByMe:
              payload.blockerId === userId ? false : state.blockedByMe,
            blockedMe: payload.blockedId === userId ? false : state.blockedMe,
          }));
          void getConversation(conversationId).then((next) => {
            if (!next) return;
            const nextBlockState = next as {
              blockedByMe?: boolean;
              blockedMe?: boolean;
            };
            setBlockState({
              blockedByMe: Boolean(nextBlockState.blockedByMe),
              blockedMe: Boolean(nextBlockState.blockedMe),
            });
          }).catch((error) => {
            console.error("Failed to refresh conversation block state:", error);
          });
          toast(
            "Messaging is available again in this conversation.",
            "default",
          );
        },
      )
      .on(
        "broadcast",
        { event: "typing" },
        ({ payload }: { payload: TypingPayload }) => {
          if (!payload || !payload.userId || payload.userId === userId) return;
          if (payload.isTyping) {
            setIsTyping(true);
            setTypingUserIds((current) => new Set(current).add(payload.userId!));
            const previousTimer = typingTimersRef.current.get(payload.userId!);
            if (previousTimer) clearTimeout(previousTimer);
            typingTimersRef.current.set(payload.userId!, setTimeout(() => {
              setTypingUserIds((current) => {
                const next = new Set(current);
                next.delete(payload.userId!);
                setIsTyping(next.size > 0);
                return next;
              });
              typingTimersRef.current.delete(payload.userId!);
            }, 3000));
          } else {
            setTypingUserIds((current) => {
              const next = new Set(current);
              next.delete(payload.userId!);
              setIsTyping(next.size > 0);
              return next;
            });
          }
        },
      )
      .on(
        "broadcast",
        { event: "read-receipt" },
        ({ payload }: { payload: ReadReceiptPayload }) => {
          if (!payload || payload.userId === userId || !payload.lastReadAt) {
            return;
          }
          const readAt = new Date(payload.lastReadAt);
          if (conversationTypeRef.current === "GROUP") {
            setGroupReadAt((current) => ({ ...current, [payload.userId]: readAt.getTime() }));
          } else {
            updateOtherParticipantLastReadAt(readAt);
          }
        },
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          // The initial mark-read can happen before this channel is ready.
          // Replay it over Broadcast once the channel is connected.
          if (lastReadAtRef.current) {
            broadcastReadReceipt(lastReadAtRef.current);
          } else {
            triggerMarkReadRef.current(true);
          }

          // A re-join (after a network drop, tab wake, or token refresh) has a
          // hole: Broadcast does not replay what was sent while we were away.
          // The first join does not need this — the page just fetched the
          // conversation — so only reconnects pay for the catch-up query.
          if (hasSubscribed) catchUpLatestMessages();
          hasSubscribed = true;
        } else if (process.env.NODE_ENV === "development") {
          console.warn(`Conversation realtime status: ${status}`);
        }
      });
    });

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Resynchronize read state when the tab wakes up.
        triggerMarkReadRef.current();
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    const typingTimers = typingTimersRef.current;

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      for (const timer of typingTimers.values()) clearTimeout(timer);
      typingTimers.clear();
      if (channel) void supabase.removeChannel(channel);
      roomRef.current = null;
    };
  }, [
    userId,
    conversationId,
    broadcastReadReceipt,
    handleBroadcastMessage,
    handleBroadcastUpdate,
    updateOtherParticipantLastReadAt,
    catchUpLatestMessages,
    toast,
  ]);

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

  // Stable ref for broadcastTyping to avoid resetting typing timeout
  const broadcastTypingRef = useRef(broadcastTyping);
  useEffect(() => {
    broadcastTypingRef.current = broadcastTyping;
  }, [broadcastTyping]);

  useEffect(() => {
    const closeOnOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-block-menu]")) setMenuOpen(false);
      if (!target.closest("[data-group-menu]")) setGroupMenuOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    return () => document.removeEventListener("mousedown", closeOnOutside);
  }, []);

  // `conversation.id !== conversationId` covers an in-flight switch: the route
  // changed but the new conversation has not loaded yet. Rendering the previous
  // thread under the new URL is what made the chat look stale until a refresh.
  if (!user || !conversation || conversation.id !== conversationId) {
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
        const result = await unblockUser(otherParticipant.id);
        if (!result.success) {
          toast(actionErrorMessage(result, "Failed to unblock scholar."), "error");
          return;
        }
        setBlockState((s) => ({ ...s, blockedByMe: false }));
        roomRef.current
          ?.send({
            type: "broadcast",
            event: "CONVERSATION_UNBLOCKED",
            payload: { blockerId: userId, blockedId: otherParticipant.id },
          })
          .catch(() => {});
        toast(
          `${otherParticipant.name || "Scholar"} unblocked. You can message them again.`,
          "default",
        );
      } else {
        const result = await blockUser(otherParticipant.id);
        if (!result.success) {
          toast(actionErrorMessage(result, "Failed to block scholar."), "error");
          return;
        }
        setBlockState((s) => ({ ...s, blockedByMe: true }));
        roomRef.current
          ?.send({
            type: "broadcast",
            event: "CONVERSATION_BLOCKED",
            payload: { blockerId: userId, blockedId: otherParticipant.id },
          })
          .catch(() => {});
        toast(
          `${otherParticipant.name || "Scholar"} blocked. They can no longer message you.`,
          "default",
        );
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

  const handleLeaveGroup = async () => {
    if (!userId || isLeaving) return;
    setIsLeaving(true);
    try {
      const result = await removeGroupParticipant(conversationId, userId);
      if (!result.success) {
        toast(actionErrorMessage(result, "Failed to leave group."), "error");
        return;
      }
      toast("You left the group.", "default");
      router.replace("/messages");
    } finally {
      setIsLeaving(false);
      setLeaveConfirmOpen(false);
    }
  };

  // Re-read the thread after the group-info panel changes membership. If the
  // viewer is gone (left, or was removed while the panel was open), the action
  // returns null and the route has to leave the thread.
  const refreshAfterMembershipChange = () => {
    void getConversation(conversationId)
      .then((fresh) => {
        if (!fresh) {
          toast("You are no longer a participant of this group.", "error");
          router.replace("/messages");
          return;
        }
        setConversation(fresh as unknown as Conversation);
      })
      .catch((error) => {
        console.error("Failed to refresh conversation after membership change:", error);
      });
  };

  // ⚡ ISSUE 5: A block in either direction disables the composer.
  const isPeerFrozen = !isGroup && Boolean(otherParticipant?.isFrozen);
  const isChatDisabled =
    isCurrentUserFrozen ||
    isPeerFrozen ||
    Boolean(isGroup && conversation?.isFrozen) ||
    blockState.blockedByMe ||
    blockState.blockedMe;

  const headerIdentity = (
    <>
      <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200 dark:bg-slate-800">
        {isGroup ? (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-blue-100 text-sm font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">G</div>
        ) : otherParticipant?.avatarUrl ? (
          <UserAvatar
            src={otherParticipant.avatarUrl}
            name={otherParticipant?.name}
            imageClassName="rounded-full"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-300 text-sm font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-200">
            {otherParticipant?.name?.charAt(0).toUpperCase() || "@"}
          </div>
        )}
      </div>
      <div className="min-w-0">
        <h1 className="truncate font-semibold text-slate-900 dark:text-slate-100">
          {isGroup ? conversation?.title || "Group discussion" : otherParticipant?.name || "Scholar"}
        </h1>
        <p className="truncate text-sm text-slate-500 dark:text-slate-400">
          {isTyping ? (
            <span className="text-blue-500 font-medium italic">
              {isGroup ? `${typingNames.slice(0, 2).join(", ") || "Someone"}${typingNames.length > 2 ? " and others" : ""} typing…` : "typing..."}
            </span>
          ) : isGroup ? (
            <span>{onlineGroupCount > 0 ? `${onlineGroupCount} online` : `${conversation?.participants.length ?? 0} participants`}</span>
          ) : isOtherOnline ? (
            <span className="text-green-500 font-medium">Online</span>
          ) : !isGroup && otherParticipant?.handle ? (
            `@${otherParticipant.handle}`
          ) : (
            "scholar"
          )}
        </p>
      </div>
    </>
  );

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="relative z-40 flex h-16 shrink-0 items-center border-b border-slate-200 sb-navbar-bg px-2 dark:border-slate-800 sm:px-4">
        <button
          type="button"
          onClick={() => setIsSidebarOpen((current) => !current)}
          className="mr-2 inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white/80 text-slate-600 shadow-sm backdrop-blur-sm dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-300"
          aria-label={isSidebarOpen ? "Collapse conversations" : "Expand conversations"}
        >
          {isSidebarOpen ? <ChevronsLeft className="h-6 w-6" /> : <ChevronsRight className="h-6 w-6" />}
        </button>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          {isGroup ? (
            // WhatsApp-style: tapping the group header opens the info panel.
            <button
              type="button"
              onClick={() => setIsGroupInfoOpen(true)}
              className="flex min-w-0 items-center gap-3 rounded-xl text-left transition hover:opacity-80"
              aria-label="Open group info"
            >
              {headerIdentity}
            </button>
          ) : (
            <Link
              prefetch={false}
              href={otherParticipant ? `/scholars/${otherParticipant.id}` : "#"}
              className="flex shrink-0 items-center gap-3"
            >
              {headerIdentity}
            </Link>
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {isGroup ? (
            <div className="relative" data-group-menu>
              <button
                onClick={() => setGroupMenuOpen((o) => !o)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
                aria-label="Group actions"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
              {groupMenuOpen && (
                <div className="absolute right-0 top-12 z-menu w-56 origin-top-right rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900">
                  <button
                    onClick={() => {
                      setGroupMenuOpen(false);
                      setIsGroupInfoOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Users className="h-4 w-4" />
                    Group info
                  </button>
                  <button
                    onClick={() => {
                      setGroupMenuOpen(false);
                      setGroupReportOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
                  >
                    <Flag className="h-4 w-4" />
                    Report group
                  </button>
                  <button
                    onClick={() => {
                      setGroupMenuOpen(false);
                      setLeaveConfirmOpen(true);
                    }}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Leave group
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="relative" data-block-menu>
              <button
                onClick={() => setMenuOpen((o) => !o)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300"
              >
                <MoreVertical className="h-5 w-5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-12 z-menu w-56 origin-top-right rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900">
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
          )}
        </div>
      </div>

      {isGroup && conversation.isFrozen && (
        <div className="shrink-0 px-3 pt-3 sm:px-4">
          <FrozenContentBanner
            entityId={conversation.id}
            module="MESSAGES"
            entityType="POST"
            ownerId={conversation.createdById}
            currentUserId={user.id}
            hasActiveAppeal={conversation.hasActiveAppeal}
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto pt-4 pb-6">
        <div className="px-2 sm:px-4">
          <MessageList
            conversationId={conversation.id}
            initialMessages={conversation.messages}
            user={user}
            otherParticipantLastReadAt={new Date(groupReadCutoff)}
            registerAppend={handleAppendMessage}
            registerAddFailed={handleRegisterAddFailed}
            registerUpdate={handleRegisterUpdate}
            registerSyncLatest={handleRegisterSyncLatest}
            onMessageRejected={handleMessageRejected}
            onSetReplyingTo={setReplyingTo}
            canManageMessages={
              !isCurrentUserFrozen &&
              !blockState.blockedByMe &&
              !blockState.blockedMe
            }
          />
        </div>
      </div>

      {isChatDisabled && (
        <div
          role="alert"
          className="flex shrink-0 flex-wrap items-center justify-center gap-3 border-t border-amber-200 bg-amber-50 px-4 py-3 text-center text-sm font-medium text-amber-800 dark:border-amber-900 dark:bg-amber-950/60 dark:text-amber-300"
        >
          {isCurrentUserFrozen ? (
            <span>Your account is frozen. Messaging is disabled.</span>
          ) : isPeerFrozen ? (
            <span>
              This scholar&apos;s account is currently frozen. Messaging is
              unavailable.
            </span>
          ) : blockState.blockedMe ? (
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
        onMessageRejected={handleMessageRejected}
        currentUser={user}
        onTyping={broadcastTyping}
        isDisabled={isChatDisabled}
        replyingTo={replyingTo}
        onCancelReply={() => setReplyingTo(null)}
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

      {isGroup && (
        <GroupInfoPanel
          conversationId={conversation.id}
          open={isGroupInfoOpen}
          onClose={() => setIsGroupInfoOpen(false)}
          onLeft={() => router.replace("/messages")}
          onMembershipChanged={refreshAfterMembershipChange}
        />
      )}

      {isGroup && (
        <ReportModal
          isOpen={groupReportOpen}
          onClose={() => setGroupReportOpen(false)}
          entityId={conversation.id}
          entityType="POST"
          module="MESSAGES"
          onReported={async () => {
            setGroupReportOpen(false);
            if (userId) {
              await removeGroupParticipant(conversation.id, userId);
              router.replace("/messages");
            }
          }}
        />
      )}

      <ConfirmationModal
        isOpen={leaveConfirmOpen}
        onClose={() => setLeaveConfirmOpen(false)}
        onConfirm={handleLeaveGroup}
        title="Leave group"
        message="You will stop receiving messages from this group. This cannot be undone without a new invitation."
        confirmLabel="Leave"
        confirmingLabel="Leaving..."
        isConfirming={isLeaving}
      />
    </div>
  );
}
