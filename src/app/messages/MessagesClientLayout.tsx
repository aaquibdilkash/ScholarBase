"use client";

import { useState, useEffect, Suspense, useContext, useRef } from "react";
import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { usePathname } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { useTimeAgo } from "@/utils/use-time-ago";
import type { User, RealtimePostgresChangesPayload, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getInbox } from "@/app/actions/messages";
import { usePresence } from "@/components/interactions/PresenceProvider";
import { MessagesLayoutContext } from "./messages-context";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type Participant = { user: { id: string; name: string | null; handle: string | null; avatarUrl: string | null; }; lastReadAt: Date | string | null; };
type Message = { body: string; createdAt?: Date | string | number; created_at?: Date | string | number; senderId?: string; sender_id?: string; sender?: { id: string; }; };
type InboxConversation = { id: string; lastMessageAt: Date | string; participants: Participant[]; messages: Message[]; unreadCount: number; };

type MessageRow = {
  id: string;
  body: string;
  senderId?: string;
  sender_id?: string;
  conversation_id?: string;
  conversationId?: string;
  created_at: string;
  createdAt?: string;
};

// Presence state typing now lives in PresenceProvider (global channel).

/** ⚡ Shared-ticker relative timestamp for sidebar previews (Issue 2). */
function SidebarTimeAgo({ date }: { date: Date | string | number | null | undefined }) {
  const label = useTimeAgo(date);
  return <>{label}</>;
}

function ConversationSidebar({ user }: { user: User | null }) {
  const [inbox, setInbox] = useState<InboxConversation[]>([]);
  const { onlineUserIds } = usePresence();
  const [, setTick] = useState(0);

  const inboxRef = useRef<InboxConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const pathname = usePathname();
  const { isSidebarOpen, setIsSidebarOpen } = useContext(MessagesLayoutContext)!;

  useEffect(() => {
    inboxRef.current = inbox;
  }, [inbox]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  // ⚡ PRESENCE: Online status now comes from the single global
  // `presence:global` channel (PresenceProvider) — no per-component channels.

  useEffect(() => {
    if (user) {
      setIsLoading(true);
      getInbox(user.id)
        .then((data) => setInbox(data))
        .catch(() => setInbox([]))
        .finally(() => setIsLoading(false));
    } else {
      setInbox([]);
      setIsLoading(false);
    }
  }, [user]);

  function normalizeTimestamp(value: Date | string | number | null | undefined): Date | string | number {
    if (!value && value !== 0) return new Date();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // ⚡ Postgres timestamps can arrive naive (no timezone). Treat them as
      // UTC so relative times are never skewed by the client's locale.
      if (!/[Zz]$|[+-]\d{2}:?\d{2}$/.test(trimmed)) {
        return trimmed.replace(' ', 'T') + 'Z';
      }
    }
    return value;
  }

  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('sidebar-global-listener')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Message' }, (payload: RealtimePostgresChangesPayload<MessageRow>) => {
          const rawMessage = payload.new as MessageRow;
          const msgConvId = rawMessage.conversationId || rawMessage.conversation_id;

          const convExists = inboxRef.current.some((c) => c.id === msgConvId);

          if (!convExists) {
            getInbox(user.id).then((data) => setInbox(data));
          } else {
            setInbox((currentInbox) => {
              const convIndex = currentInbox.findIndex((c) => c.id === msgConvId);
              if (convIndex === -1) return currentInbox; 

              const updatedInbox = [...currentInbox];
              const targetConv = { ...updatedInbox[convIndex] };
              // ⚡ Keep senderId + createdAt in the preview so unread math and
              // relative timestamps stay correct.
              targetConv.messages = [{
                body: rawMessage.body,
                senderId: rawMessage.senderId || rawMessage.sender_id,
                createdAt: normalizeTimestamp(rawMessage.createdAt || rawMessage.created_at),
              }];
              targetConv.lastMessageAt = normalizeTimestamp(rawMessage.createdAt || rawMessage.created_at) as string | Date;
              const senderId = rawMessage.senderId || rawMessage.sender_id;
              
              // ⚡ ISSUE 1: Never count the current user's own messages as unread.
              if (senderId !== user.id) {
                targetConv.unreadCount = (targetConv.unreadCount || 0) + 1;
              }
              
              updatedInbox.splice(convIndex, 1);
              updatedInbox.unshift(targetConv);
              return updatedInbox;
            });
          }
        }
      ).on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ConversationParticipant' }, (payload: RealtimePostgresChangesPayload<{ conversationId: string; userId: string; lastReadAt: string | null }>) => {
          const change = payload.new as { conversationId: string; userId: string; lastReadAt: string | null };
          if (change.userId !== user.id) return; 
          
          // ⚡ ISSUE 1: This row only updates when the current user reads or
          // sends in this conversation — either way nothing is unread anymore.
          setInbox((currentInbox) => {
            return currentInbox.map((conv) => {
              if (conv.id !== change.conversationId) return conv;
              return {
                ...conv,
                unreadCount: 0,
                participants: conv.participants.map((p) =>
                  p.user.id === user.id && change.lastReadAt
                    ? { ...p, lastReadAt: change.lastReadAt }
                    : p,
                ),
              };
            });
          });
        }
      ).subscribe();

    const handleConversationRead = (event: CustomEvent) => {
      const { conversationId, userId: eventUserId } = event.detail;
      if (eventUserId !== user.id) return;
      
      setInbox((currentInbox) => {
        return currentInbox.map((conv) => {
          if (conv.id !== conversationId) return conv;
          return {
            ...conv,
            unreadCount: 0,
            participants: conv.participants.map((p) =>
              p.user.id === user.id ? { ...p, lastReadAt: new Date() } : p,
            ),
          };
        });
      });
    };

    // ⚡ ISSUE 1 & 2: Optimistic sidebar sync when the active chat window sends
    // a message — update preview, lastMessageAt, own read state and re-sort
    // immediately, without waiting for the server or realtime events.
    const handleMessageSent = (event: CustomEvent) => {
      const { conversationId, message } = event.detail;
      
      setInbox((currentInbox) => {
        const convIndex = currentInbox.findIndex((c) => c.id === conversationId);
        if (convIndex === -1) return currentInbox;

        const updatedInbox = [...currentInbox];
        const targetConv = { ...updatedInbox[convIndex] };
        targetConv.messages = [{
          body: message.body,
          senderId: message.senderId,
          createdAt: message.createdAt,
        }];
        targetConv.lastMessageAt = message.createdAt;
        // ⚡ The sender has by definition read everything up to now.
        targetConv.unreadCount = 0;
        targetConv.participants = targetConv.participants.map((p) =>
          p.user.id === message.senderId
            ? { ...p, lastReadAt: message.createdAt }
            : p,
        );
        
        updatedInbox.splice(convIndex, 1);
        updatedInbox.unshift(targetConv);
        return updatedInbox;
      });
    };

    window.addEventListener('conversation-read', handleConversationRead as EventListener);
    window.addEventListener('message-sent', handleMessageSent as EventListener);
    return () => { 
      supabase.removeChannel(channel);
      window.removeEventListener('conversation-read', handleConversationRead as EventListener);
      window.removeEventListener('message-sent', handleMessageSent as EventListener);
    };
  }, [user]);

  const closeSidebarIfMobile = () => {
    if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
      setIsSidebarOpen(false);
    }
  };
  const handleNewMessageClick = () => closeSidebarIfMobile();

  const filteredInbox = inbox.filter((conversation) => {
    const otherParticipant = conversation.participants.find(p => p.user.id !== user?.id)?.user;
    const searchLower = searchQuery.toLowerCase();
    return (
      otherParticipant?.name?.toLowerCase().includes(searchLower) ||
      otherParticipant?.handle?.toLowerCase().includes(searchLower)
    );
  });

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white dark:bg-slate-950">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
        {isSidebarOpen && <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Conversations</h2>}
        <div className="flex items-center gap-2">
          {isSidebarOpen && ( 
            <Link href="/messages/new" onClick={handleNewMessageClick} className="sb-button-primary w-full justify-center dark:bg-black dark:hover:bg-black">New</Link>
          )}
          <button onClick={() => setIsSidebarOpen((prev) => !prev)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
            {isSidebarOpen ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {isSidebarOpen && (
        <div className="px-4 pb-2 pt-2 border-b border-slate-100 dark:border-slate-900">
          <input
            type="text"
            placeholder="Search scholars..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="sb-input w-full rounded-xl px-3 py-2 text-sm bg-slate-50 dark:bg-slate-900"
          />
        </div>
      )}

      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {isSidebarOpen && (user ? (
          isLoading ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading conversations...
            </div>
           ) : filteredInbox.length > 0 ? (
             <div className="space-y-2 p-2 overflow-x-hidden">
               {filteredInbox.map((conversation) => {
                 const otherParticipant = conversation.participants.find((p) => p.user.id !== user.id)?.user ?? conversation.participants[0]?.user;
                 const latestMessage = conversation.messages[0];
                 const participantData = conversation.participants.find((p) => p.user.id === user.id);
                 const lastReadAt = participantData?.lastReadAt ? new Date(participantData.lastReadAt) : new Date(0);
                 // ⚡ ISSUE 1: Own outgoing messages must never mark the thread unread.
                 const latestSenderId = latestMessage
                   ? (latestMessage.senderId || latestMessage.sender_id || latestMessage.sender?.id)
                   : undefined;
                 const isUnread =
                   conversation.unreadCount > 0 ||
                   (latestSenderId !== undefined &&
                     latestSenderId !== user.id &&
                     new Date(conversation.lastMessageAt) > lastReadAt);
                 const isActive = pathname === `/messages/${conversation.id}`;
                 const isOtherUserOnline = onlineUserIds.has(otherParticipant?.id || "");

                 return (
                  <Link
                    key={conversation.id}
                    href={`/messages/${conversation.id}`}
                    onClick={() => {
                      setInbox((current) =>
                        current.map((item) =>
                          item.id === conversation.id
                            ? { ...item, unreadCount: 0 }
                            : item,
                        ),
                      );
                      closeSidebarIfMobile();
                    }}
                    className={`block rounded-lg transition ${isSidebarOpen ? "p-3" : "p-3 flex justify-center h-16"} ${isActive ? "bg-slate-100 dark:bg-slate-800 px-3 py-3" : isUnread ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-100 dark:hover:bg-slate-800/70"}`}
                  >
                    <div className={`flex items-center ${isSidebarOpen ? "justify-between" : "justify-center"}`}>
                      <div className={`flex items-center ${isSidebarOpen ? "gap-3" : ""}`}>
                        <div className="relative h-10 w-10 shrink-0">
                          {otherParticipant?.avatarUrl ? (
                            <UserAvatar
                              src={otherParticipant.avatarUrl}
                              name={otherParticipant?.name}
                              imageClassName="rounded-full"
                              fallbackClassName="rounded-full bg-slate-200 text-sm font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                              {otherParticipant?.name?.charAt(0).toUpperCase() || otherParticipant?.handle?.charAt(0).toUpperCase() || "@"}
                            </div>
                          )}
                          {isOtherUserOnline && otherParticipant?.id && <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-green-500 border-2 border-white dark:border-slate-950"></div>}
                          {!isOtherUserOnline && isUnread && <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-white dark:border-slate-950"></div>}
                        </div>
                        {isSidebarOpen && ( 
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 dark:text-slate-100">{otherParticipant?.name || "Scholar"}</div>
                            {latestMessage && (
                              <p className={`mt-0.5 line-clamp-1 text-sm ${isUnread ? "text-slate-800 font-medium dark:text-slate-200" : "text-slate-500 dark:text-slate-400"}`}>
                                {latestMessage.body}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                      {isSidebarOpen && (
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <div suppressHydrationWarning className={`text-xs ${isUnread ? "text-blue-600 font-semibold dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}>{<SidebarTimeAgo date={conversation.lastMessageAt} />}</div>
                          {conversation.unreadCount > 0 && (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold leading-none text-white">
                              {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">No conversations found.</div>
          )
        ) : (
          <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">Please sign in to see your conversations.</div>
        ))}
      </div>
    </div>
  );
}

export default function MessagesClientLayout({ 
  children, 
  defaultOpen 
}: { 
  children: React.ReactNode;
  defaultOpen: boolean;
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(defaultOpen);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    document.cookie = `sb-conversation-sidebar-open=${isSidebarOpen}; path=/; max-age=31536000`;
  }, [isSidebarOpen]);

  useEffect(() => {
    if (window.innerWidth < 768) {
      setIsSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null } }) => setUser(user));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, []);

  return (
    <MessagesLayoutContext.Provider value={{ isSidebarOpen, setIsSidebarOpen }}>
      <div className="relative flex h-[calc(100vh-10rem)] min-h-[28rem] overflow-hidden md:h-[calc(100vh-12rem)]">
        {isSidebarOpen && <div className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm md:hidden" onClick={() => setIsSidebarOpen(false)} aria-hidden="true" />}
        <div className={`fixed top-0 left-0 z-40 h-full shrink-0 md:static md:h-auto md:z-auto flex-col border-r border-slate-200 bg-white transition-all duration-300 ease-in-out dark:border-slate-800 dark:bg-slate-950 ${isSidebarOpen ? "w-80 translate-x-0" : "w-16 -translate-x-full md:translate-x-0"}`}>
          <Suspense fallback={<div className="p-4">Loading conversations...</div>}>
            <ConversationSidebar user={user} />
          </Suspense>
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">{children}</div>
      </div>
    </MessagesLayoutContext.Provider>
  );
}