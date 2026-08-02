import { createClient } from "@/utils/supabase/server";
import { getInbox } from "@/app/actions/messages";
import Link from "next/link";
import { formatTimeAgo } from "@/utils/time-ago";

async function ConversationSidebar() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-4 text-sm text-slate-500">
        Please sign in to see your conversations.
      </div>
    );
  }

  const inbox = await getInbox(user.id);

  return (
    <div className="h-full overflow-y-auto">
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
          Conversations
        </h2>
        <Link
          href="/messages/new"
          className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
        >
          New
        </Link>
      </div>
      <div className="space-y-2 p-2">
        {inbox.map((conversation) => {
          const otherParticipant =
            conversation.participants.find(
              (participant) => participant.user.id !== user.id,
            )?.user ?? conversation.participants[0]?.user;
          const latestMessage = conversation.messages[0];
          const isUnread =
            new Date(conversation.lastMessageAt) >
            (conversation.participants.find((p) => p.user.id === user.id)
              ?.lastReadAt || 0);

          return (
            <Link
              key={conversation.id}
              href={`/messages/${conversation.id}`}
              className={`block rounded-lg p-3 transition ${
                isUnread
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
                      <div className="flex h-full w-full items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-500">
                        {otherParticipant?.name?.charAt(0).toUpperCase() ||
                          otherParticipant?.handle?.charAt(0).toUpperCase() ||
                          "@"}
                      </div>
                    )}
                    {isUnread && (
                      <div className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-blue-500 border-2 border-white"></div>
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
                <div className="text-xs text-slate-400">
                  {formatTimeAgo(conversation.lastMessageAt)}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default function MessagesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-[calc(100vh-10rem)] min-h-[28rem] overflow-hidden md:h-[calc(100vh-12rem)]">
      <div className="hidden w-80 shrink-0 flex-col border-r border-slate-200 dark:border-slate-800 md:flex">
        <ConversationSidebar />
      </div>
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {children}
      </div>
    </div>
  );
}
