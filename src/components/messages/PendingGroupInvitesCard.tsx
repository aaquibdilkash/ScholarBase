"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MailOpen, X } from "lucide-react";
import {
  getPendingGroupInvites,
  respondToGroupInvite,
} from "@/app/actions/messages";
import { useToast } from "@/components/ui/Toast";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { actionErrorMessage } from "@/lib/utils";

type PendingInvite = Awaited<ReturnType<typeof getPendingGroupInvites>>[number];

/**
 * Pending group invitations, rendered above the inbox.
 *
 * Invitees are deliberately NOT participants (see `ConversationInvite`), so the
 * inbox query cannot surface them — this card is the only place a new invite is
 * discoverable while the invitee has no thread to open yet.
 */
export function PendingGroupInvitesCard() {
  const router = useRouter();
  const { toast } = useToast();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    // A pending invite is never load-bearing for the inbox; a failed read just
    // hides the card instead of breaking the sidebar.
    void getPendingGroupInvites()
      .then((rows) => setInvites(rows))
      .catch((error) => {
        console.error("Failed to load group invites:", error);
      });
  }, []);

  useEffect(() => {
    load();
    // Invites are delivered by a QStash notification, not Realtime, so a tab
    // that was asleep when one arrived picks it up when it wakes.
    const onVisible = () => {
      if (!document.hidden) load();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [load]);

  const respond = async (invite: PendingInvite, accept: boolean) => {
    if (busyId) return;
    setBusyId(invite.conversationId);
    try {
      const result = await respondToGroupInvite(invite.conversationId, accept);
      if (!result.success) {
        toast(actionErrorMessage(result, "Failed to respond to invitation."), "error");
        return;
      }
      setInvites((current) =>
        current.filter((item) => item.conversationId !== invite.conversationId),
      );
      if (accept) {
        // Let the inbox prepend the row before the route change, exactly like a
        // newly created conversation.
        window.dispatchEvent(
          new CustomEvent("conversation-created", {
            detail: { conversationId: invite.conversationId },
          }),
        );
        router.push(`/messages/${invite.conversationId}`);
      }
    } finally {
      setBusyId(null);
    }
  };

  if (invites.length === 0) return null;

  return (
    <div className="space-y-2 border-b border-slate-100 px-2 py-2 dark:border-slate-900">
      <p className="px-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Group invites
      </p>
      {invites.map((invite) => {
        const isBusy = busyId === invite.conversationId;
        const groupTitle = invite.conversation.title || "Group discussion";
        return (
          <div
            key={invite.conversationId}
            className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-300 dark:bg-slate-800">
                {invite.inviter.avatarUrl ? (
                  <UserAvatar
                    src={invite.inviter.avatarUrl}
                    name={invite.inviter.name}
                    imageClassName="rounded-full"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-200">
                    {(invite.inviter.name || invite.inviter.handle || "?")
                      .charAt(0)
                      .toUpperCase()}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">
                    {invite.inviter.name || invite.inviter.handle || "A scholar"}
                  </span>{" "}
                  invited you
                </p>
                <p className="truncate text-xs font-medium text-slate-500 dark:text-slate-400">
                  {groupTitle}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => void respond(invite, true)}
                disabled={isBusy}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50"
              >
                {isBusy ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <MailOpen className="h-3.5 w-3.5" />
                )}
                Accept
              </button>
              <button
                type="button"
                onClick={() => void respond(invite, false)}
                disabled={isBusy}
                className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                <X className="h-3.5 w-3.5" />
                Decline
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
