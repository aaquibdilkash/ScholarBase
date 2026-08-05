"use client";

import {
  useState,
  useEffect,
  Suspense,
  createContext,
  useContext,
  Dispatch,
  SetStateAction,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { formatTimeAgo } from "@/utils/time-ago";
import type { User } from "@supabase/supabase-js";
import { getInbox } from "@/app/actions/messages";
import { useAuthModal } from "@/components/interactions/AuthModal";
import { MessagesLayoutContext } from "./messages-context";

type Participant = {
  user: {
    id: string;
    name: string | null;
    handle: string | null;
    avatarUrl: string | null;
  };
  lastReadAt: string | null;
};

type Message = {
  body: string;
};

type InboxConversation = {
  id: string;
  lastMessageAt: string;
  participants: Participant[];
  messages: Message[];
};

function ConversationSidebar({ user }: { user: User | null }) {
  const [inbox, setInbox] = useState<InboxConversation[]>([]);
  const pathname = usePathname();
  const { openAuthModal } = useAuthModal();
  const { setMobileOpen } = useContext(MessagesLayoutContext)!;


  useEffect(() => {
    if (user) {
      getInbox(user.id).then((data) => setInbox(data as any));
    } else {
      setInbox([]);
    }
  }, [user]);

  const handleNewMessageClick = (e: React.MouseEvent) => {
    if (!user) {
      e.preventDefault();
      openAuthModal();
    }
  };

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white dark:bg-slate-950">
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Conversations
        </h2>
        <Link
          href="/messages/new"
          onClick={handleNewMessageClick}
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-blue-600 dark:hover:bg-blue-500"
        >
          New
        </Link>
      </div>
      <div className="flex-1 overflow-y-auto">
        {user ? (
          inbox.length > 0 ? (
            <div className="space-y-2 p-2">
              {inbox.map((conversation) => {
                const otherParticipant =
                  conversation.participants.find(
                    (participant) => participant.user.id !== user.id,
                  )?.user ?? conversation.participants[0]?.user;
                const latestMessage = conversation.messages[0];

                const participantData = conversation.participants.find(
                  (p) => p.user.id === user.id,
                );
                const lastReadAt = participantData?.lastReadAt
                  ? new Date(participantData.lastReadAt)
                  : new Date(0);
                const isUnread =
                  new Date(conversation.lastMessageAt) > lastReadAt;

                const isActive = pathname === `/messages/${conversation.id}`;

                return (
                  <Link
                    key={conversation.id}
                    href={`/messages/${conversation.id}`}
                    onClick={() => setMobileOpen(false)}
                    className={`block rounded-lg p-3 transition ${
                      isActive
                        ? "bg-slate-100 dark:bg-slate-800"
                        : isUnread
                          ? "bg-blue-50 dark:bg-blue-950/40"
                          : "hover:bg-slate-100 dark:hover:bg-slate-800/70"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="relative h-10 w-10 shrink-0">
                          {otherParticipant?.avatarUrl ? (
                            <img
                              src={otherParticipant.avatarUrl}
                              alt={otherParticipant.name || "Scholar"}
                              className="h-full w-full rounded-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-500 dark:bg-slate-700 dark:text-slate-400">
                              {otherParticipant?.name
                                ?.charAt(0)
                                .toUpperCase() ||
                                otherParticipant?.handle
                                  ?.charAt(0)
                                  .toUpperCase() ||
                                "@"}
                            </div>
                          )}
                          {isUnread && (
                            <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-white dark:border-slate-950"></div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 dark:text-slate-100">
                            {otherParticipant?.name || "Scholar"}
                          </div>
                          {latestMessage && (
                            <p className="mt-0.5 line-clamp-1 text-sm text-slate-500 dark:text-slate-400">
                              {latestMessage.body}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="text-xs text-slate-400 dark:text-slate-500">
                        {formatTimeAgo(conversation.lastMessageAt)}
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
              No conversations yet.
            </div>
          )
        ) : (
          <div className="p-4 text-center text-sm text-slate-500 dark:text-slate-400">
            Please sign in to see your conversations.
          </div>
        )}
      </div>
    </div>
  );
}

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      },
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  return (
    <MessagesLayoutContext.Provider value={{ mobileOpen, setMobileOpen }}>
      <div className="relative flex h-[calc(100vh-10rem)] min-h-[28rem] overflow-hidden md:h-[calc(100vh-12rem)]">
        {mobileOpen && (
          <div
            className="fixed inset-0 z-30 bg-black/20 backdrop-blur-sm md:hidden"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
        )}
        <div
          className={`fixed top-0 left-0 z-40 h-full w-80 shrink-0 transform-gpu flex-col border-r border-slate-200 bg-white transition-transform md:static md:translate-x-0 dark:border-slate-800 dark:bg-slate-950 ${
            mobileOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <Suspense fallback={<div className="p-4">Loading conversations...</div>}>
            <ConversationSidebar user={user} />
          </Suspense>
        </div>
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {children}
        </div>
      </div>
    </MessagesLayoutContext.Provider>
  );
}
