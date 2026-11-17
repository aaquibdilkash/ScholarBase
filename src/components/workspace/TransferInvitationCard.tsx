"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useActionState } from "react";

import {
  declineTransferInvitationAction,
  type ManuscriptActionResult,
} from "@/app/actions/manuscripts";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";

export type AuthorInvitationView = {
  eventId: string;
  manuscriptTitle: string;
  sourceVenueName: string;
  targetVenueName: string;
  invitedByName: string | null;
  invitedOn: string;
  state: "OPEN" | "DECLINED";
};

const EMPTY_RESULT: ManuscriptActionResult = { success: false, message: "" };

/**
 * One transfer invitation in the author's workspace.
 *
 * Accepting is a link into the submission form, not a mutation: the author has
 * to read the prefilled extended-version metadata and upload a PDF before the
 * journal row exists. Declining appends `TRANSFER_DECLINED` and is confirmed
 * because only a fresh invitation from the conference editor can reopen it.
 */
export function TransferInvitationCard({
  invitation,
}: {
  invitation: AuthorInvitationView;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(
    declineTransferInvitationAction,
    EMPTY_RESULT,
  );
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!state.message) return;
    setConfirmOpen(false);
    setConfirming(false);
  }, [state]);

  const open = invitation.state === "OPEN";

  return (
    <article
      className={
        open
          ? "sb-card border-blue-500/30 bg-blue-500/5"
          : "sb-card opacity-80"
      }
    >
      <p className="text-sm font-semibold">
        {open
          ? `${invitation.targetVenueName} invited your conference paper`
          : `Invitation to ${invitation.targetVenueName} declined`}
      </p>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
        {invitation.manuscriptTitle}
      </p>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        From {invitation.sourceVenueName}
        {invitation.invitedByName
          ? ` · invited by ${invitation.invitedByName}`
          : ""}
        {` · ${invitation.invitedOn}`}
      </p>

      {open ? (
        <>
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Submitting creates a new entry in {invitation.targetVenueName}. Your
            conference paper and its acceptance decision stay untouched.
          </p>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Link
              href={`/workspace/submissions/new?invitation=${invitation.eventId}`}
              className="sb-button-primary"
            >
              Accept and submit
            </Link>

            <form ref={formRef} action={formAction}>
              <input
                type="hidden"
                name="invitationId"
                value={invitation.eventId}
              />
              <button
                type="button"
                onClick={() => setConfirmOpen(true)}
                className="sb-button-soft"
              >
                Decline
              </button>
            </form>
          </div>

          <ConfirmationModal
            isOpen={confirmOpen}
            onClose={() => setConfirmOpen(false)}
            onConfirm={() => {
              setConfirming(true);
              formRef.current?.requestSubmit();
            }}
            title="Decline this invitation?"
            message={`${invitation.targetVenueName} will be told you declined. Only a new invitation from ${invitation.sourceVenueName} can reopen it.`}
            isConfirming={confirming}
            confirmLabel="Decline invitation"
            confirmVariant="destructive"
            confirmingLabel="Declining…"
          />

          {state.message && !state.success && (
            <p role="alert" className="mt-3 text-xs text-red-600 dark:text-red-400">
              {state.message}
            </p>
          )}
        </>
      ) : (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          You declined this invitation. The record stays here for your timeline.
        </p>
      )}
    </article>
  );
}
