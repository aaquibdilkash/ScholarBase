"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import {
  Crown,
  Flag,
  Loader2,
  LogOut,
  Search,
  UserMinus,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import {
  getGroupDetails,
  inviteGroupMembers,
  removeGroupParticipant,
  revokeGroupInvite,
} from "@/app/actions/messages";
import { MAX_GROUP_PARTICIPANTS } from "@/constants/messages";
import { MIN_SEARCH_LENGTH } from "@/lib/search-guard";
import { useScholarSearch } from "@/hooks/useScholarSearch";
import { useToast } from "@/components/ui/Toast";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { ScholarSuggestionDropdown } from "@/components/interactions/ScholarSuggestionDropdown";
import { ReportModal } from "@/components/cards/ReportModal";
import { actionErrorMessage } from "@/lib/utils";

type GroupMember = {
  id: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  role: "OWNER" | "MEMBER";
  joinedAt: string | Date;
};

type PendingInvite = {
  id: string;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  invitedAt: string | Date;
};

type GroupDetails = {
  id: string;
  title: string | null;
  isFrozen: boolean;
  hasLeft?: boolean;
  createdAt: string | Date;
  createdById: string;
  viewerId: string;
  isOwner: boolean;
  participants: GroupMember[];
  pendingInvites: PendingInvite[];
};

type PendingAction =
  | { kind: "leave" }
  | { kind: "remove"; member: GroupMember }
  | { kind: "report" };

function displayName(person: { name: string | null; handle: string | null }) {
  return person.name?.trim() || person.handle?.trim() || "Scholar";
}

function formatJoined(value: string | Date) {
  return new Date(value).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function GroupInfoPanel({
  conversationId,
  open,
  onClose,
  onLeft,
  onMembershipChanged,
}: {
  conversationId: string;
  open: boolean;
  onClose: () => void;
  /** Viewer left (or was removed): navigate away from the thread. */
  onLeft: () => void;
  /** A mutation changed the member list; the thread should re-read. */
  onMembershipChanged?: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [isWorking, setIsWorking] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const { results, isSearching } = useScholarSearch(search, 8);

  const { data, isLoading, refetch } = useQuery<GroupDetails | null>({
    queryKey: ["group-details", conversationId],
    queryFn: () => getGroupDetails(conversationId) as Promise<GroupDetails | null>,
    enabled: open,
    staleTime: 10_000,
  });

  // The panel is mounted for the whole thread; closing it must not leave a
  // typed search behind for the next open.
  useEffect(() => {
    if (!open) {
      setSearch("");
      setPendingAction(null);
    }
  }, [open]);

  if (!open) return null;

  const seatsUsed = (data?.participants.length ?? 0) + (data?.pendingInvites.length ?? 0);
  const seatsLeft = Math.max(0, MAX_GROUP_PARTICIPANTS - seatsUsed);
  const canInvite = Boolean(data?.isOwner && !data.isFrozen && seatsLeft > 0);
  const isMember = (id: string) =>
    Boolean(data?.participants.some((participant) => participant.id === id));
  const isInvited = (id: string) =>
    Boolean(data?.pendingInvites.some((invite) => invite.id === id));

  const refresh = async () => {
    await refetch();
    onMembershipChanged?.();
  };

  const handleInvite = async (scholar: { id: string }) => {
    if (!scholar.id || busyId) return;
    setBusyId(scholar.id);
    try {
      const result = await inviteGroupMembers(conversationId, [scholar.id]);
      if (!result.success) {
        toast(actionErrorMessage(result, "Failed to send invitation."), "error");
        return;
      }
      setSearch("");
      toast("Invitation sent.", "default");
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const handleRevoke = async (inviteeId: string) => {
    if (busyId) return;
    setBusyId(inviteeId);
    try {
      const result = await revokeGroupInvite(conversationId, inviteeId);
      if (!result.success) {
        toast(actionErrorMessage(result, "Failed to revoke invitation."), "error");
        return;
      }
      await refresh();
    } finally {
      setBusyId(null);
    }
  };

  const executePendingAction = async () => {
    if (!pendingAction || isWorking) return;
    setIsWorking(true);
    try {
      if (pendingAction.kind === "report") {
        // Reporting is the only way a group reaches moderators; leaving is done
        // *after* the report is accepted so cancelling the dialog changes
        // nothing.
        setIsReportOpen(true);
        return;
      }

      if (pendingAction.kind === "remove") {
        const result = await removeGroupParticipant(
          conversationId,
          pendingAction.member.id,
        );
        if (!result.success) {
          toast(actionErrorMessage(result, "Failed to remove member."), "error");
          return;
        }
        toast(
          `${displayName(pendingAction.member)} was removed from the group.`,
          "default",
        );
        await refresh();
        return;
      }

      await leaveGroup();
    } finally {
      setIsWorking(false);
      setPendingAction(null);
    }
  };

  const leaveGroup = async () => {
    const result = await removeGroupParticipant(
      conversationId,
      data?.viewerId ?? "",
    );
    if (!result.success) {
      toast(actionErrorMessage(result, "Failed to leave group."), "error");
      return false;
    }
    toast("You left the group.", "default");
    await refetch();
    onLeft();
    return true;
  };

  // A successful report is followed by leaving: the group must disappear from
  // the reporter's inbox, and moderators still receive the report row.
  const handleReported = () => {
    setIsReportOpen(false);
    void leaveGroup();
  };

  const confirmCopy =
    pendingAction?.kind === "remove"
      ? {
          title: "Remove member",
          message: `Remove ${displayName(pendingAction.member)} from this group? They will need a new invitation to rejoin.`,
          label: "Remove",
        }
      : pendingAction?.kind === "report"
        ? {
            title: "Report and leave",
            message:
              "You will leave this group and its moderators will be notified. Continue?",
            label: "Report and leave",
          }
        : {
            title: "Leave group",
            message:
              "You will stop receiving messages from this group. This cannot be undone without a new invitation.",
            label: "Leave",
          };

  return (
    <>
      <div className="fixed inset-0 z-modal flex justify-end">
        <div
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Group info"
          className="relative z-modal flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-xl dark:border-slate-800 dark:bg-slate-950"
        >
          <div className="flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 px-4 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              aria-label="Close group info"
            >
              <X className="h-5 w-5" />
            </button>
            <h2 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Group info
            </h2>
          </div>

          {isLoading || !data ? (
            <div className="flex flex-1 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
            </div>
          ) : (
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-5">
              <div className="flex flex-col items-center text-center">
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 text-2xl font-bold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                  {(data.title || "G").charAt(0).toUpperCase()}
                </div>
                <h3 className="mt-3 break-words text-lg font-semibold text-slate-900 dark:text-slate-100">
                  {data.title || "Group discussion"}
                </h3>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {data.participants.length} {data.participants.length === 1 ? "participant" : "participants"}{data.pendingInvites.length > 0 ? ` · ${data.pendingInvites.length} invited` : ""}
                </p>
                <p className="text-xs text-slate-400 dark:text-slate-500">
                  Created {formatJoined(data.createdAt)}
                </p>
              </div>

              {data.isFrozen && (
                <div
                  role="alert"
                  className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400"
                >
                  ❄ This group was frozen by moderators. Messaging and membership
                  changes are disabled while it is under review.
                </div>
              )}

              <section className="mt-6">
                <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                  <Users className="h-4 w-4" />
                  Participants
                </h4>
                <ul className="space-y-1">
                  {data.participants.map((member) => {
                    const isYou = member.id === data.viewerId;
                    const canRemove =
                      data.isOwner && !isYou && !data.isFrozen && !busyId;
                    return (
                      <li
                        key={member.id}
                        className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-900"
                      >
                        <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full bg-slate-300 dark:bg-slate-800">
                          {member.avatarUrl ? (
                            <UserAvatar
                              src={member.avatarUrl}
                              name={member.name}
                              imageClassName="rounded-full"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-200">
                              {displayName(member).charAt(0).toUpperCase()}
                            </div>
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p
                            className="truncate text-sm font-medium text-slate-800 dark:text-slate-100 cursor-pointer"
                            onClick={() => void router.push(`/scholars/${member.id}`)}
                          >
                            {displayName(member)}
                            {isYou && (
                              <span className="ml-1 text-xs font-normal text-slate-400">
                                (you)
                              </span>
                            )}
                          </p>
                          <p
                            className="flex items-center gap-1 truncate text-xs text-slate-500 dark:text-slate-400"
                          >
                            {member.role === "OWNER" && (
                              <Crown className="h-3 w-3 text-amber-500" />
                            )}
                            {member.role === "OWNER"
                              ? "Group owner"
                              : member.handle
                                ? `@${member.handle}`
                                : "Member"}
                          </p>
                        </div>
                        {canRemove && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setPendingAction({ kind: "remove", member });
                            }}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400"
                            aria-label={`Remove ${displayName(member)}`}
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        )}
                      </li>
                    );
                  })}
                </ul>

                {data.isOwner && data.pendingInvites.length > 0 && (
                  <div className="mt-3">
                    <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                      Invited · {data.pendingInvites.length} pending
                    </p>
                    <ul className="space-y-1">
                      {data.pendingInvites.map((invite) => (
                        <li
                          key={invite.id}
                          className="flex items-center gap-3 rounded-xl px-2 py-2"
                        >
                          <div className="h-8 w-8 shrink-0 overflow-hidden rounded-full bg-slate-300 dark:bg-slate-800">
                            {invite.avatarUrl ? (
                              <UserAvatar
                                src={invite.avatarUrl}
                                name={invite.name}
                                imageClassName="rounded-full"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-xs font-semibold text-slate-600 dark:text-slate-200">
                                {displayName(invite).charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm text-slate-700 dark:text-slate-300">
                              {displayName(invite)}
                            </p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">
                              Awaiting response
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRevoke(invite.id)}
                            disabled={Boolean(busyId)}
                            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-700 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                            aria-label={`Revoke invitation for ${displayName(invite)}`}
                          >
                            {busyId === invite.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <X className="h-4 w-4" />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {canInvite && (
                <section className="mt-6">
                  <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <UserPlus className="h-4 w-4" />
                    Add participants
                  </h4>
                  <div className="relative">
                    <div className="relative">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                      <input
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Search scholars to invite…"
                        autoComplete="off"
                        className="sb-input w-full pl-9"
                        aria-label="Search scholars to invite"
                      />
                    </div>
                    <ScholarSuggestionDropdown
                      suggestions={results.filter(
                        (scholar) => !isMember(scholar.id) && !isInvited(scholar.id),
                      )}
                      loading={isSearching}
                      loadingMessage="Searching scholars…"
                      onSelect={(scholar) => void handleInvite(scholar)}
                      emptyMessage={
                        search.trim().length >= MIN_SEARCH_LENGTH
                          ? "No matching scholars."
                          : undefined
                      }
                    />
                  </div>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    {seatsLeft} {seatsLeft === 1 ? "seat" : "seats"} left,
                    pending invitations included.
                  </p>
                </section>
              )}

              <section className="mt-8 space-y-2 border-t border-slate-100 pt-4 dark:border-slate-800">
                {!data.hasLeft && (
                  <button
                    type="button"
                    onClick={() => setPendingAction({ kind: "leave" })}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-500/10"
                  >
                    <LogOut className="h-4 w-4" />
                    Leave group
                  </button>
                )}
                {data.hasLeft && (
                  <p className="rounded-xl bg-slate-100 px-3 py-2.5 text-sm font-medium text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                    You left this group. Its history is read-only.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => setPendingAction({ kind: "report" })}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <Flag className="h-4 w-4" />
                  Report group
                </button>
              </section>
            </div>
          )}
        </aside>
      </div>

      <ConfirmationModal
        isOpen={pendingAction !== null && !isReportOpen}
        onClose={() => setPendingAction(null)}
        onConfirm={executePendingAction}
        title={confirmCopy.title}
        message={confirmCopy.message}
        confirmLabel={confirmCopy.label}
        confirmingLabel="Working..."
        isConfirming={isWorking}
      />

      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        entityId={conversationId}
        entityType="POST"
        module="MESSAGES"
        onReported={handleReported}
      />
    </>
  );
}
