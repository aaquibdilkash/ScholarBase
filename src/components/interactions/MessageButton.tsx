"use client";

import Link from "next/link";
import { useAuthModal } from "@/components/interactions/AuthModal";
import { useUser } from "@/hooks/useUser";
import { MessageCircle } from "lucide-react";

export function MessageButton({
  recipientId,
  recipientName,
}: {
  recipientId: string;
  recipientName?: string | null;
}) {
  const { user } = useUser();
  const { openAuthModal } = useAuthModal();

  const baseClass =
    "inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 sm:flex-none sm:px-6";

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

  const href = `/messages/new?to=${recipientId}`;

  return (
    <Link prefetch={false}
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
  return <MessageCircle className="h-4 w-4" />;
}
