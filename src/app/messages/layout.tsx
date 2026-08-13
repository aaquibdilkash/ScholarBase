"use client";

import { useState, useEffect, Suspense, useContext } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { formatTimeAgo } from "@/utils/time-ago";
import type { User, RealtimePostgresChangesPayload, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getInbox } from "@/app/actions/messages";
import useMediaQuery from "@/hooks/useMediaQuery";
import { MessagesLayoutContext } from "./messages-context";
import { ChevronLeft, ChevronRight } from "lucide-react"; 

type Participant = { user: { id: string; name: string | null; handle: string | null; avatarUrl: string | null; }; lastReadAt: Date | string | null; };
type Message = { body: string; };
type InboxConversation = { id: string; lastMessageAt: Date | string; participants: Participant[]; messages: Message[]; };

type MessageRow = {
  id: string;
  body: string;
  conversation_id?: string;
  conversationId?: string;
  created_at: string;
  createdAt?: string; // Re-added
};

function ConversationSidebar({ user }: { user: User | null }) {
  const [inbox, setInbox] = useState<InboxConversation[]>([]);
  const [searchQuery, setSearchQuery] = useState(""); // ⚡ SEARCH STATE
  const pathname = usePathname();
  const { isSidebarOpen, setIsSidebarOpen } = useContext(MessagesLayoutContext)!; 

  useEffect(() => {
    if (user) getInbox(user.id).then((data) => setInbox(data));
    else setInbox([]);
  }, [user]);

  // ⚡ THE GLOBAL REALTIME SIDEBAR LISTENER
  useEffect(() => {
    if (!user) return;
    const channel = supabase.channel('sidebar-global-listener')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'Message' }, (payload: RealtimePostgresChangesPayload<MessageRow>) => {
          const rawMessage = payload.new as MessageRow;
          const msgConvId = rawMessage.conversationId || rawMessage.conversation_id;

          setInbox((currentInbox) => {
            const convIndex = currentInbox.findIndex((c) => c.id === msgConvId);
            if (convIndex === -1) {
              getInbox(user.id).then((data) => setInbox(data));
              return currentInbox;
            }
            const updatedInbox = [...currentInbox];
            const targetConv = { ...updatedInbox[convIndex] };
            targetConv.messages = [{ body: rawMessage.body }];
            targetConv.lastMessageAt = rawMessage.createdAt || rawMessage.created_at;
            updatedInbox.splice(convIndex, 1);
            updatedInbox.unshift(targetConv);
            return updatedInbox;
          });
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const handleNewMessageClick = () => { if (user) setIsSidebarOpen(false); };

  // ⚡ FILTER INBOX BY SEARCH QUERY
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

      {/* ⚡ THE SEARCH BAR */}
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
          filteredInbox.length > 0 ? (
            <div className="space-y-2 p-2 overflow-x-hidden">
              {filteredInbox.map((conversation) => {
                const otherParticipant = conversation.participants.find((p) => p.user.id !== user.id)?.user ?? conversation.participants[0]?.user;
                const latestMessage = conversation.messages[0];
                const participantData = conversation.participants.find((p) => p.user.id === user.id);
                const lastReadAt = participantData?.lastReadAt ? new Date(participantData.lastReadAt) : new Date(0);
                const isUnread = new Date(conversation.lastMessageAt) > lastReadAt;
                const isActive = pathname === `/messages/${conversation.id}`;

                return (
                  <Link
                    key={conversation.id}
                    href={`/messages/${conversation.id}`}
                    onClick={() => setIsSidebarOpen(false)}
                    className={`block rounded-lg transition ${isSidebarOpen ? "p-3" : "p-3 flex justify-center h-16"} ${isActive ? "bg-slate-100 dark:bg-slate-800 px-3 py-3" : isUnread ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-100 dark:hover:bg-slate-800/70"}`}
                  >
                    <div className={`flex items-center ${isSidebarOpen ? "justify-between" : "justify-center"}`}>
                      <div className={`flex items-center ${isSidebarOpen ? "gap-3" : ""}`}>
                        <div className="relative h-10 w-10 shrink-0">
                          {otherParticipant?.avatarUrl ? (
                            <Image src={otherParticipant.avatarUrl} alt={otherParticipant.name || "Scholar"} width={40} height={40} unoptimized className="h-full w-full rounded-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                              {otherParticipant?.name?.charAt(0).toUpperCase() || otherParticipant?.handle?.charAt(0).toUpperCase() || "@"}
                            </div>
                          )}
                          {isUnread && <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-white dark:border-slate-950"></div>}
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
                      {isSidebarOpen && <div className={`text-xs ${isUnread ? "text-blue-600 font-semibold dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}>{formatTimeAgo(conversation.lastMessageAt)}</div>}
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

export default function MessagesLayout({ children }: { children: React.ReactNode; }) {
  const isDesktop = useMediaQuery("(min-width: 768px)");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [conversationSidebarPreferenceLoaded, setConversationSidebarPreferenceLoaded] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const savedPreference = localStorage.getItem("sb-conversation-sidebar-open");
    setIsSidebarOpen(
      savedPreference === null
        ? window.matchMedia("(min-width: 768px)").matches
        : savedPreference === "true",
    );
    setConversationSidebarPreferenceLoaded(true);
  }, []);
  useEffect(() => {
    if (conversationSidebarPreferenceLoaded) {
      localStorage.setItem("sb-conversation-sidebar-open", String(isSidebarOpen));
    }
  }, [isSidebarOpen, conversationSidebarPreferenceLoaded]);
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
