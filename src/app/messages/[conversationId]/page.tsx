import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { getConversation } from '@/app/actions/messages'
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
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 rounded-full bg-slate-200">
            {otherParticipant?.avatarUrl ? (
              <img
                src={otherParticipant.avatarUrl}
                alt={otherParticipant.name || "Scholar"}
                className="h-full w-full rounded-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-sm font-semibold text-slate-500">
                {otherParticipant?.name?.charAt(0).toUpperCase() || "@"}
              </div>
            )}
          </div>
          <div>
            <h1 className="font-semibold text-slate-900">
              {otherParticipant?.name || "Scholar"}
            </h1>
            <p className="text-sm text-slate-500">
              {otherParticipant?.handle
                ? `@${otherParticipant.handle}`
                : "scholar"}
            </p>
          </div>
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