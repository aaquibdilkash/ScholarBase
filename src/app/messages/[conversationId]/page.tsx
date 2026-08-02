import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getConversation } from "@/app/actions/messages";
import { MessageInputForm } from "@/components/messages/MessageInputForm";
import { MessageList } from "@/components/messages/MessageList";
import { createClient } from "@/utils/supabase/server";

export const metadata: Metadata = {
  title: "Conversation",
  description: "A direct collaboration conversation between scholars.",
  robots: { index: false, follow: true },
};

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    notFound();
  }

  const conversation = await getConversation(conversationId, user.id);

  if (!conversation) {
    notFound();
  }

  const otherParticipant = conversation.participants.find(
    (p) => p.user.id !== user.id,
  )?.user;

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex h-16 shrink-0 items-center border-b border-slate-200 px-4 dark:border-slate-800">
        <div className="flex min-w-0 items-center gap-3">
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
      </div>
      <div className="flex-1 overflow-y-auto p-4">
        <MessageList
          conversationId={conversation.id}
          initialMessages={conversation.messages}
          user={user}
        />
      </div>
      <MessageInputForm conversationId={conversation.id} />
    </div>
  );
}
