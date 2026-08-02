"use client";

import Link from "next/link";
import { useAuthModal } from "@/components/interactions/AuthModal";
import { useUser } from "@/hooks/useUser";

export function MessageButton({
  recipientId,
  recipientName,
  existingConversationId,
}: {
  recipientId: string;
  recipientName?: string | null;
  existingConversationId?: string | null;
}) {
  const { user } = useUser();
  const { openAuthModal } = useAuthModal();

  const baseClass =
    "inline-flex items-center justify-center gap-2 rounded-lg bg-slate-950 px-6 py-2 text-sm font-semibold text-white transition hover:bg-slate-800";

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => openAuthModal()}
        className={baseClass}
        title={`Send a message to ${recipientName ?? "this scholar"}`}
      >
        <MessageIcon />
        Message
      </button>
    );
  }

  const href = existingConversationId
    ? `/messages/${existingConversationId}`
    : `/messages/new?to=${recipientId}`;

  return (
    <Link
      href={href}
      className={baseClass}
      title={`Send a message to ${recipientName ?? "this scholar"}`}
    >
      <MessageIcon />
      Message
    </Link>
  );
}

function MessageIcon() {
  return (
    <svg
      className="h-4 w-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
        d="M8 10h.01M12 10h.01M16 10h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
      />
    </svg>
  );
}
