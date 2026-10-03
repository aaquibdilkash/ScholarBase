"use client";

import { useState, useEffect, useCallback, Suspense, useContext, useRef, type Dispatch, type SetStateAction } from "react";
import Link from "next/link";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { usePathname } from "next/navigation";
import { supabase } from "@/utils/supabase/client";
import { useTimeAgo } from "@/utils/use-time-ago";
import type { User, RealtimePostgresChangesPayload, AuthChangeEvent, Session } from "@supabase/supabase-js";
import { getInbox, searchInbox } from "@/app/actions/messages";
import { usePresence } from "@/components/interactions/PresenceProvider";
import { EnablePushButton } from "@/components/push/EnablePushButton";
import { MessagesLayoutContext } from "./messages-context";
import { Check, CheckCheck, ChevronsLeft, ChevronsRight, Loader2 } from "lucide-react";
import useMediaQuery from "@/hooks/useMediaQuery";

type Participant = { user: { id: string; name: string | null; handle: string | null; avatarUrl: string | null; isFrozen?: boolean; isDeleted?: boolean; }; lastReadAt: Date | string | null; };
type Message = { id?: string; body: string; createdAt?: Date | string | number; created_at?: Date | string | number; senderId?: string; sender_id?: string; sender?: { id: string; }; };
type InboxConversation = { id: string; lastMessageAt: Date | string; participants: Participant[]; messages: Message[]; unreadCount: number; };

// ⚡ INFINITE SCROLL: conversations per page.
const PAGE_SIZE = 10;

// Presence state typing now lives in PresenceProvider (global channel).

/** ⚡ Shared-ticker relative timestamp for sidebar previews (Issue 2). */
function SidebarTimeAgo({ date }: { date: Date | string | number | null | undefined }) {
  const label = useTimeAgo(date);
  return <>{label}</>;
}

function ConversationSidebar({ user, isAuthLoading, isInline = false }: { user: User | null; isAuthLoading: boolean; isInline?: boolean }) {
  const [inbox, setInbox] = useState<InboxConversation[]>([]);
  const { onlineUserIds } = usePresence();
  const [, setTick] = useState(0);

  const inboxRef = useRef<InboxConversation[]>([]);
  const inboxRefreshInFlightRef = useRef<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  // ⚡ PAGINATION + SERVER-SIDE SEARCH state.
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchResults, setSearchResults] = useState<InboxConversation[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);
  const { isSidebarOpen, setIsSidebarOpen, mobileOpen } = useContext(MessagesLayoutContext)!;
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // ⚡ Only the INLINE copy (mobile /messages) hides the collapse toggle — it
  // has no drawer to collapse. The desktop drawer on /messages keeps it, since
  // the cookie-driven collapsed rail still applies there.
  const isInlineList = isInline;

  // ⚡ ZERO CLS: this is derived from state only — never from a JS-measured
  // breakpoint — so SSR and the first client paint always agree. On desktop it
  // tracks the cookie-backed state; on mobile it flips when the drawer opens.
  const showExpanded = isInlineList ? true : isSidebarOpen || mobileOpen;

  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

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
      getInbox(user.id, PAGE_SIZE)
        .then((data) => {
          setInbox(data);
          setHasMore(data.length === PAGE_SIZE);
        })
        .catch(() => setInbox([]))
        .finally(() => setIsLoading(false));
    } else {
      setInbox([]);
      setHasMore(false);
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
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'ConversationParticipant' }, (payload: RealtimePostgresChangesPayload<{ conversationId: string; userId: string; lastReadAt: string | null }>) => {
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

    // The active conversation already receives the confirmed message over
    // Broadcast. Reuse that event for the sidebar instead of fetching the
    // inbox again.
    const handleMessageReceived = (event: CustomEvent) => {
      const { conversationId, message } = event.detail ?? {};
      if (!conversationId || !message || message.senderId === user.id) return;

      if (!inboxRef.current.some((item) => item.id === conversationId)) {
        // The conversation may be outside the current paginated page. Load
        // one inbox page only once per conversation so its row can appear
        // with the server-computed unread count.
        if (!inboxRefreshInFlightRef.current.has(conversationId)) {
          inboxRefreshInFlightRef.current.add(conversationId);
          getInbox(user.id, PAGE_SIZE)
            .then((data) => {
              const fresh = data.find((item) => item.id === conversationId);
              if (fresh) {
                setInbox((current) => [
                  fresh,
                  ...current.filter((item) => item.id !== conversationId),
                ]);
              }
            })
            .finally(() => {
              inboxRefreshInFlightRef.current.delete(conversationId);
            });
        }
        return;
      }

      setInbox((currentInbox) => {
        const convIndex = currentInbox.findIndex((c) => c.id === conversationId);
        if (convIndex === -1) return currentInbox;

        const updatedInbox = [...currentInbox];
        const targetConv = { ...updatedInbox[convIndex] };
        const isDuplicate = targetConv.messages[0]?.id === message.id;
        targetConv.messages = [{
          id: message.id,
          body: message.body,
          senderId: message.senderId,
          createdAt: normalizeTimestamp(message.createdAt),
        }];
        targetConv.lastMessageAt = normalizeTimestamp(message.createdAt) as string | Date;
        const routeSegments = pathnameRef.current.split("/").filter(Boolean);
        const activeConversationId =
          routeSegments[0] === "messages" ? routeSegments[1] : undefined;
        const isActiveConversation =
          activeConversationId === decodeURIComponent(String(conversationId));
        if (!isDuplicate && !isActiveConversation) {
          targetConv.unreadCount = (targetConv.unreadCount || 0) + 1;
        }
        updatedInbox.splice(convIndex, 1);
        updatedInbox.unshift(targetConv);
        return updatedInbox;
      });
    };

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
    window.addEventListener('message-received', handleMessageReceived as EventListener);
    return () => { 
      supabase.removeChannel(channel);
      window.removeEventListener('conversation-read', handleConversationRead as EventListener);
      window.removeEventListener('message-sent', handleMessageSent as EventListener);
      window.removeEventListener('message-received', handleMessageReceived as EventListener);
    };
  }, [user]);

  // ⚡ INFINITE SCROLL: fetch the next page using the last loaded conversation
  // as the cursor. Skipped entirely while a search is active.
  const loadMore = useCallback(() => {
    if (!user || isLoadingMore || !hasMore || searchQuery.trim()) return;
    const cursor = inboxRef.current[inboxRef.current.length - 1]?.id;
    if (!cursor) return;
    setIsLoadingMore(true);
    getInbox(user.id, PAGE_SIZE, cursor)
      .then((data) => {
        setInbox((prev) => {
          const seen = new Set(prev.map((c) => c.id));
          const fresh = data.filter((c) => !seen.has(c.id));
          return [...prev, ...fresh];
        });
        setHasMore(data.length === PAGE_SIZE);
      })
      .catch(() => setHasMore(false))
      .finally(() => setIsLoadingMore(false));
  }, [user, isLoadingMore, hasMore, searchQuery]);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || searchResults !== null) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) loadMore();
      },
      { rootMargin: "120px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [loadMore, searchResults]);

  // ⚡ SEARCH: debounced server-side search across ALL conversations in the
  // database. An empty query clears the search results and returns to the
  // paginated list.
  useEffect(() => {
    if (!user) return;
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(() => {
      searchInbox(user.id, q)
        .then(setSearchResults)
        .catch(() => setSearchResults([]))
        .finally(() => setIsSearching(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, user]);

  // ⚡ Keep the laptop sidebar open on conversation selection. Only the mobile
  // drawer should collapse after a click; desktop uses the persisted rail state.
  const closeSidebarIfMobile = () => {
    if (!isDesktop) {
      setIsSidebarOpen(false);
    }
  };
  const handleNewMessageClick = () => closeSidebarIfMobile();

  // ⚡ When searching, show the server results (from the whole database);
  // otherwise show the paginated inbox. No client-side filtering.
  const displayList = searchResults ?? inbox;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className={`flex h-16 shrink-0 items-center border-b border-slate-200 px-2.5 dark:border-slate-800 sm:px-4 ${showExpanded ? "justify-between gap-2" : "justify-center"}`}>
        {showExpanded && <h2 className="min-w-0 truncate text-base font-semibold text-slate-900 dark:text-slate-100 sm:text-lg xl:text-xl">Conversations</h2>}
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          {/* ⚡ Bell sits LEFT of the New button. Always visible (it was
              `hidden sm:inline-flex`, which hid it below the 640px `sm`
              breakpoint on phones) in BOTH the inline /messages list and the
              conversation drawer, matching the main navbar bell. */}
          {showExpanded && (
            <span className="inline-flex">
              <EnablePushButton variant="compact" />
            </span>
          )}
          {showExpanded && ( 
            <Link prefetch={false} href="/messages/new" onClick={handleNewMessageClick} className="sb-button-primary min-h-8 px-3 py-1.5 text-xs dark:bg-black dark:hover:bg-black sm:px-4 sm:py-2">New</Link>
          )}
          {/* No drawer to collapse on the inline /messages list. */}
          {!isInlineList && (
            <button onClick={() => setIsSidebarOpen((prev) => !prev)} className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" aria-label={showExpanded ? "Collapse conversations" : "Expand conversations"}>
              {showExpanded ? <ChevronsLeft className="h-5 w-5" /> : <ChevronsRight className="h-5 w-5" />}
            </button>
          )}
        </div>
      </div>

      {showExpanded && (
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
        {user ? (
          isLoading ? (
            <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {showExpanded && <span>Loading conversations...</span>}
            </div>
          ) : displayList.length > 0 ? (
            <div className="space-y-2 p-2 overflow-x-hidden">
              {displayList.map((conversation) => {
                const otherParticipantData = conversation.participants.find((p) => p.user.id !== user.id) ?? conversation.participants[0];
                const otherParticipant = otherParticipantData?.user ?? conversation.participants[0]?.user;
                const latestMessage = conversation.messages[0];
                const participantData = conversation.participants.find((p) => p.user.id === user.id);
                const lastReadAt = participantData?.lastReadAt ? new Date(participantData.lastReadAt) : new Date(0);
                const latestSenderId = latestMessage
                  ? (latestMessage.senderId || latestMessage.sender_id || latestMessage.sender?.id)
                  : undefined;
                const latestMessageIsMine = latestSenderId === user.id;
                const latestMessageCreatedAt = latestMessage
                  ? new Date((latestMessage.createdAt ?? latestMessage.created_at ?? 0) as Date | string | number)
                  : null;
                const otherParticipantLastReadAt = otherParticipantData?.lastReadAt
                  ? new Date(otherParticipantData.lastReadAt)
                  : new Date(0);
                const isLastMessageReadByOther = Boolean(
                  latestMessageIsMine &&
                  latestMessageCreatedAt &&
                  latestMessageCreatedAt <= otherParticipantLastReadAt,
                );
                const isUnread =
                  conversation.unreadCount > 0 ||
                  (latestSenderId !== undefined &&
                    latestSenderId !== user.id &&
                    new Date(conversation.lastMessageAt) > lastReadAt);
                const isActive = pathname === `/messages/${conversation.id}`;
                const isOtherUserOnline = !otherParticipant?.isFrozen && onlineUserIds.has(otherParticipant?.id || "");

                return (
                  <Link prefetch={false}
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
                    className={`block rounded-lg transition ${showExpanded ? "p-3" : "p-2 flex justify-center"} ${isActive ? "bg-slate-100 dark:bg-slate-800" : isUnread ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-100 dark:hover:bg-slate-800/70"}`}
                  >
                    <div className={`flex items-center ${showExpanded ? "justify-between" : "justify-center"}`}>
                      <div className={`flex items-center ${showExpanded ? "gap-3" : ""}`}>
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
                        {showExpanded && ( 
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
                      {showExpanded && (
                        <div className="flex shrink-0 flex-col items-end gap-1">
                          <div suppressHydrationWarning className={`text-xs ${isUnread ? "text-blue-600 font-semibold dark:text-blue-400" : "text-slate-400 dark:text-slate-500"}`}>{<SidebarTimeAgo date={conversation.lastMessageAt} />}</div>
                          {latestMessageIsMine ? (
                            <div className="flex items-center text-slate-400 dark:text-slate-500">
                              {isLastMessageReadByOther ? (
                                <CheckCheck className="h-3.5 w-3.5 text-blue-500 dark:text-blue-400" />
                              ) : (
                                <Check className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                              )}
                            </div>
                          ) : conversation.unreadCount > 0 ? (
                            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-600 px-1.5 text-[10px] font-bold leading-none text-white">
                              {conversation.unreadCount > 99 ? "99+" : conversation.unreadCount}
                            </span>
                          ) : null}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
              {/* ⚡ INFINITE SCROLL sentinel: loads the next page when scrolled into view */}
              {searchResults === null && hasMore && (
                <div ref={sentinelRef} className="flex justify-center p-4">
                  {isLoadingMore && <Loader2 className="h-4 w-4 animate-spin text-slate-400 dark:text-slate-500" />}
                </div>
              )}
            </div>
          ) : showExpanded ? (
            <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
              {isSearching ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : "No conversations found."}
            </div>
          ) : null
          ) : showExpanded ? (
           isAuthLoading ? (
             <div className="flex items-center justify-center gap-2 p-6 text-sm text-slate-500 dark:text-slate-400">
               <Loader2 className="h-4 w-4 animate-spin" />
               <span>Loading conversations...</span>
             </div>
           ) : (
            <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">Please sign in to see your conversations.</div>
           )
          ) : null
         }
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
  // ⚡ MIRRORS src/components/layout/Sidebar.tsx: desktop and mobile track the
  // open/closed state as two SEPARATE pieces of state. Only the desktop intent
  // is cookie-persisted, so a mobile session can never overwrite the desktop
  // preference (they otherwise share one viewport-independent cookie).
  const [desktopOpen, setDesktopOpen] = useState(defaultOpen);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  // ⚡ ZERO CLS: `isSidebarOpen` drives what the SERVER renders, so it must be
  // correct on first paint. It is derived purely from the cookie-backed
  // `defaultOpen` prop and never from a JS-measured breakpoint — `useMediaQuery`
  // reports `false` during SSR/hydration (getServerSnapshot), so branching the
  // render on it would paint the drawer closed and then slide it open right
  // after reload. Responsive open/close is CSS (`lg:` classes), exactly like
  // Sidebar.tsx; `mobileOpen` only drives the off-canvas mobile slide.

  // Only used inside event handlers — never for rendering — so the SSR `false`
  // snapshot of useMediaQuery can never affect first paint.
  const isDesktop = useMediaQuery("(min-width: 1024px)");

  // ⚡ On /messages ONLY the mobile view swaps the drawer for an inline list, so
  // scholars don't tap a chevron just to see conversations. Desktop is
  // untouched: the drawer renders exactly as before, driven by the cookie.
  // Both are pure CSS (`lg:hidden` / `max-lg:hidden`) so SSR output still
  // matches the first paint on every viewport.
  const pathname = usePathname();
  const isInboxIndex = pathname === "/messages";

  // ⚡ /messages/new is an ordinary add/edit form that merely happens to live
  // under /messages. It must NOT inherit the two-pane conversation shell: that
  // wrapper renders `.sb-messages-page`, which triggers the global
  // `body:has(main .sb-messages-page) main { padding: 0 !important }` reset in
  // globals.css and gives the page a fixed-height `overflow-hidden` body. Both
  // are wrong for a form — it lost its page gutter and scrolled inside a
  // clipped box. Bypassing the shell here lets it behave exactly like
  // /supervisor/add and every other add/edit page.
  const isStandaloneForm = pathname === "/messages/new";

  const isSidebarOpen = desktopOpen;

  // ⚡ Setter updates whichever state the CURRENT viewport actually renders, so a
  // tap always affects what the user can see. It still runs only after
  // hydration, so it never influences SSR output.
  const setIsSidebarOpen = useCallback<
    Dispatch<SetStateAction<boolean>>
  >((action) => {
    const apply = (current: boolean) =>
      typeof action === "function"
        ? (action as (prev: boolean) => boolean)(current)
        : action;

    if (isDesktop) {
      setDesktopOpen((current) => {
        const newState = apply(current);
        if (newState !== current) {
          document.cookie = `sb-conversation-sidebar-open=${newState}; path=/; max-age=31536000`;
        }
        return newState;
      });
    } else {
      setMobileOpen((current) => apply(current));
    }
  }, [isDesktop]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }: { data: { user: User | null } }) => {
      setUser(user);
      setIsAuthLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: AuthChangeEvent, session: Session | null) => {
      setUser(session?.user ?? null);
      setIsAuthLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  // ⚡ MEASURE THE REAL NAVBAR: The fixed conversations drawer must start
  // exactly where the navbar ends. The navbar's height is not a fixed token
  // (min-h-14 on mobile, min-h-16 from `sm`, its bottom border, plus the
  // frozen-account banner can all change it), so we publish its measured
  // height as --sb-navbar-h and consume it in the classes below. The 3.5rem
  // fallback keeps the first paint correct before JS runs. On lg+ the drawer
  // is `lg:static`, so the variable only affects the fixed small-screen drawer.
  useEffect(() => {
    // ⚡ Target the top navbar by id — a plain `querySelector("nav")` would
    // match the main Sidebar's inner <nav> link list, which renders first in
    // the DOM and is ~half the viewport tall.
    const navbar = document.getElementById("sb-navbar");
    if (!navbar) return;
    const setVar = () =>
      document.documentElement.style.setProperty(
        "--sb-navbar-h",
        `${navbar.offsetHeight}px`,
      );
    setVar();
    const observer = new ResizeObserver(setVar);
    observer.observe(navbar);
    window.addEventListener("resize", setVar);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", setVar);
    };
  }, []);

  return (
    <MessagesLayoutContext.Provider value={{ isSidebarOpen, setIsSidebarOpen, mobileOpen }}>
       <div className="sb-messages-page relative flex h-[calc(100dvh-var(--sb-navbar-h,3.5rem))] min-h-[28rem] overflow-hidden lg:h-full lg:min-h-0 lg:flex-1">
          {/* ⚡ ZERO CLS: the backdrop is always mounted and fades via opacity so it
          animates in step with the drawer instead of popping. Mobile visibility
          is driven by `mobileOpen` (via CSS translate), never by a JS
          breakpoint, so SSR output already matches the first paint. */}
        {!isInboxIndex && (
          <div
            aria-hidden="true"
            onClick={() => setIsSidebarOpen(false)}
            className={`fixed inset-0 z-30 bg-slate-950/25 backdrop-blur-[1px] transition-opacity duration-300 lg:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
          />
        )}
        {/* ⚡ ZERO CLS: ONE ConversationSidebar is mounted, never two.
            On /messages the container simply stops being an off-canvas drawer
            below `lg` and becomes the full-width page (in-flow, no translate) —
            so mobile needs no chevron tap and no duplicate channel. At `lg`+ it
            is the original cookie-driven sidebar, untouched. All of this is CSS,
            so SSR output still matches the first paint. */}
        <div
          className={
            isInboxIndex
              ? `relative z-0 flex w-full min-h-0 flex-1 flex-col border-b border-slate-200 sb-sidebar-bg lg:static lg:z-auto lg:h-auto lg:w-80 lg:flex-none lg:border-b-0 lg:border-r dark:border-slate-800 ${isSidebarOpen ? "lg:w-80" : "lg:w-16"}`
              : `fixed top-[var(--sb-navbar-h,3.5rem)] left-0 z-50 h-[calc(100dvh-var(--sb-navbar-h,3.5rem))] shrink-0 lg:static lg:h-auto lg:z-auto flex-col border-r border-slate-200 sb-sidebar-bg transition-all duration-300 ease-in-out dark:border-slate-800 ${mobileOpen ? "translate-x-0" : "-translate-x-full"} lg:translate-x-0 w-80 max-w-[calc(var(--sb-min-viewport-width)-1.5rem)] ${isSidebarOpen ? "lg:w-80" : "lg:w-16"}`
          }
        >
          <Suspense fallback={
            <div className="flex items-center justify-center gap-2 p-4 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isSidebarOpen && <span>Loading conversations...</span>}
            </div>
          }>
            <ConversationSidebar user={user} isAuthLoading={isAuthLoading} isInline={isInboxIndex} />
          </Suspense>
        </div>
        {/* ⚡ /messages/new keeps the conversation sidebar on desktop, but it is a
            normal form page — not the two-pane conversation view. The global
            `body:has(main .sb-messages-page) main { padding: 0 !important }`
            reset (needed so the drawer is full-bleed) strips the root gutter, so
            the standard `.sb-shell` spacing is re-applied on THIS column only.
            Same px-4 sm:px-6 lg:px-8 / py-4 lg:py-10 as every other form. */}
        <div
          className={`min-w-0 flex-1 flex-col overflow-hidden ${
            isInboxIndex ? "max-lg:hidden" : "flex"
          } ${isStandaloneForm ? "overflow-y-auto px-4 sm:px-6 lg:px-8 py-4 lg:py-10" : ""}`}
        >
          {children}
        </div>
      </div>
    </MessagesLayoutContext.Provider>
  );
}
