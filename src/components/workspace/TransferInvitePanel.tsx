"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";

import { Select } from "@/components/ui/Select";
import {
  inviteAuthorToJournalAction,
  type ManuscriptActionResult,
} from "@/app/actions/manuscripts";

export type TransferInvitation = {
  id: string;
  venueId: string;
  journalName: string;
  invitedOn: string;
  /** True when the author declined this invitation; the journal can be retried. */
  declined: boolean;
};

export type TransferCandidate = {
  id: string;
  title: string;
  authorName: string | null;
  authorEmail: string;
  conferenceName: string;
  invitations: TransferInvitation[];
  /** Journals this paper already has a live extended submission with. */
  transferredVenueIds: string[];
};

export type JournalOption = {
  id: string;
  name: string;
};

const EMPTY_RESULT: ManuscriptActionResult = { success: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="sb-button-primary w-full justify-center sm:w-auto"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Sending…
        </span>
      ) : (
        "Send invitation"
      )}
    </button>
  );
}

function ResultMessage({ state }: { state: ManuscriptActionResult }) {
  if (!state.message) return null;

  return (
    <p
      role={state.success ? "status" : "alert"}
      className={
        state.success
          ? "rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-200"
          : "rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300"
      }
    >
      {state.message}
    </p>
  );
}

function InviteForm({
  candidate,
  journals,
}: {
  candidate: TransferCandidate;
  journals: JournalOption[];
}) {
  const [state, formAction] = useActionState(
    inviteAuthorToJournalAction,
    EMPTY_RESULT,
  );

  const invitedVenueIds = new Set(
    candidate.invitations
      .filter((invitation) => !invitation.declined)
      .map((invitation) => invitation.venueId),
  );
  const available = journals.filter(
    (journal) =>
      !invitedVenueIds.has(journal.id) &&
      !candidate.transferredVenueIds.includes(journal.id),
  );

  return (
    <article className="sb-card">
      <p className="font-medium">{candidate.title}</p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {candidate.authorName ?? candidate.authorEmail}
        {` · ${candidate.conferenceName}`}
      </p>

      {candidate.invitations.length > 0 && (
        <ul className="mt-3 space-y-1 text-sm text-slate-600 dark:text-slate-300">
          {candidate.invitations.map((invitation) => (
            <li key={invitation.id}>
              {invitation.declined ? "Declined invitation to " : "Invited to "}
              {invitation.journalName}
              {` · ${invitation.invitedOn}`}
            </li>
          ))}
        </ul>
      )}

      {available.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-300">
          {journals.length === 0
            ? "No published journal is accepting extended versions yet."
            : "This paper already has an open invitation or a submission at every available journal."}
        </p>
      ) : (
        <form action={formAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <input type="hidden" name="manuscriptId" value={candidate.id} />
          <div className="min-w-0 flex-1">
            <label
              htmlFor={`target-${candidate.id}`}
              className="sb-label"
            >
              Invite to
            </label>
            <Select
              id={`target-${candidate.id}`}
              name="targetVenueId"
              className="sb-select"
              defaultValue={available[0]?.id}
            >
              {available.map((journal) => (
                <option key={journal.id} value={journal.id}>
                  {journal.name}
                </option>
              ))}
            </Select>
          </div>
          <SubmitButton />
        </form>
      )}

      <div className="mt-3 empty:hidden">
        <ResultMessage state={state} />
      </div>
    </article>
  );
}

/**
 * Conference → journal transfer invitations.
 *
 * The editor only invites. The author creates the journal submission, so the
 * list deliberately has no "move" or "accept" control here.
 */
export function TransferInvitePanel({
  candidates,
  journals,
}: {
  candidates: TransferCandidate[];
  journals: JournalOption[];
}) {
  if (candidates.length === 0) {
    return (
      <p className="sb-card text-sm text-slate-600 dark:text-slate-300">
        No paper is currently accepted to your conference proceedings.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {candidates.map((candidate) => (
        <InviteForm
          key={candidate.id}
          candidate={candidate}
          journals={journals}
        />
      ))}
    </div>
  );
}
