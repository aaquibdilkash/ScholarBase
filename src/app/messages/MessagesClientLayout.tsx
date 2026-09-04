"use client";

import { useState, useEffect, Suspense, useContext, useRef } from "react";
import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { usePathname } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { formatTimeAgo } from "@/utils/time-ago";
import type { User, RealtimePostgresChangesPayload, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getInbox } from "@/app/actions/messages";
import { MessagesLayoutContext } from "./messages-context";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type Participant = { user: { id: string; name: string | null; handle: string | null; avatarUrl: string | null; }; lastReadAt: Date | string | null; };
type Message = { body: string; createdAt?: Date | string; created_at?: Date | string; senderId?: string; sender_id?: string; };
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

type PresenceState = {
  [userId: string]: Array<{
    online_at?: string;
  }>;
};

function ConversationSidebar({ user }: { user: User | null }) {
  const [inbox, setInbox] = useState<InboxConversation[]>([]);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
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
    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

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

  useEffect(() => {
    if (!user) return;

    const presenceChannel = supabase.channel('online-presence', {
      config: { presence: { key: user.id } },
    });

    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState() as PresenceState;
        const onlineIds = new Set(Object.keys(state));
        setOnlineUserIds(onlineIds);
      })
      .on('presence', { event: 'join' }, ({ key }: { key: string }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.add(key);
          return next;
        });
      })
      .on('presence', { event: 'leave' }, ({ key }: { key: string }) => {
        setOnlineUserIds((prev) => {
          const next = new Set(prev);
          next.delete(key);
          return next;
        });
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await presenceChannel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(presenceChannel);
    };
  }, [user]);

  function normalizeTimestamp(value: Date | string | number | null | undefined): Date | string | number {
    if (!value && value !== 0) return new Date();
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?$/.test(trimmed)) {
        return trimmed + 'Z';
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
              targetConv.messages = [{ body: rawMessage.body }];
              targetConv.lastMessageAt = normalizeTimestamp(rawMessage.createdAt || rawMessage.created_at) as string | Date;
              const senderId = rawMessage.senderId || rawMessage.sender_id;
              
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
          
          if (change.lastReadAt) {
            setInbox((currentInbox) => {
              return currentInbox.map((conv) => {
                if (conv.id !== change.conversationId) return conv;
                const lastReadAt = new Date(change.lastReadAt!);
                const unreadCount = conv.messages.filter((m) => {
                  const senderId = m.senderId || m.sender_id;
                  const msgDate = m.createdAt || m.created_at;
                  return senderId !== user.id && msgDate && new Date(msgDate) > lastReadAt;
                }).length;
                return { ...conv, unreadCount };
              });
            });
          }
        }
      ).subscribe();

    const handleConversationRead = (event: CustomEvent) => {
      const { conversationId, userId: eventUserId } = event.detail;
      if (eventUserId !== user.id) return;
      
      setInbox((currentInbox) => {
        return currentInbox.map((conv) => {
          if (conv.id !== conversationId) return conv;
          const lastReadAt = new Date();
          const unreadCount = conv.messages.filter((m) => {
            const senderId = m.senderId || m.sender_id;
            const msgDate = m.createdAt || m.created_at;
            return senderId !== user.id && msgDate && new Date(msgDate) > lastReadAt;
          }).length;
          return { ...conv, unreadCount };
        });
      });
    };

    const handleMessageSent = (event: CustomEvent) => {
      const { conversationId, message } = event.detail;
      
      setInbox((currentInbox) => {
        const convIndex = currentInbox.findIndex((c) => c.id === conversationId);
        if (convIndex === -1) return currentInbox;

        const updatedInbox = [...currentInbox];
        const targetConv = { ...updatedInbox[convIndex] };
        targetConv.messages = [{ body: message.body }];
        targetConv.lastMessageAt = message.createdAt;
        
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
  const handleNewMessageClick = () => { if (user) closeSidebarIfMobile(); };

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
                 const isUnread = conversation.unreadCount > 0 || new Date(conversation.lastMessageAt) > lastReadAt;
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
                          <div suppressHydrationWarning className={`text-xs ${isUnread ? "text-blue-600 font-semibold dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}>{formatTimeAgo(conversation.lastMessageAt)}</div>
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