import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentUser } from "@/lib/auth";
import { findOpenInvitationForAuthor } from "@/lib/publishing/invitations";
import { ManuscriptSubmissionForm } from "@/components/workspace/ManuscriptSubmissionForm";

/**
 * Acceptance form for one journal invitation.
 *
 * The invitation id is resolved server-side against the signed-in author, so a
 * guessed id cannot reveal another author's paper or target. An invitation that
 * was declined, already used, or never existed renders the same closed state —
 * there is nothing to distinguish for someone probing ids.
 */
export default async function NewSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ invitation?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { invitation: invitationId } = await searchParams;
  const invitation = invitationId
    ? await findOpenInvitationForAuthor({
        invitationEventId: invitationId,
        authorId: user.id,
      })
    : null;

  if (!invitation) {
    return (
      <main>
        <header className="mb-6">
          <h1 className="sb-heading text-2xl">Submit an extended version</h1>
        </header>
        <div className="sb-card">
          <p className="text-sm">
            This invitation is not open. It may have been declined, already
            used, or withdrawn by the conference.
          </p>
          <Link
            href="/workspace/submissions"
            className="sb-button-soft mt-4 inline-flex"
          >
            Back to your submissions
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main>
      <header className="mb-6">
        <h1 className="sb-heading text-2xl break-words">
          Submit to {invitation.targetVenue.name}
        </h1>
        <p className="sb-subtitle mt-2 text-sm">
          This creates a new submission at {invitation.targetVenue.name}. Your
          conference paper at {invitation.manuscript.venue.name} keeps its own
          status and acceptance record.
        </p>
      </header>

      <ManuscriptSubmissionForm
        invitationId={invitation.eventId}
        sourceTitle={invitation.manuscript.title}
        sourceVenueName={invitation.manuscript.venue.name}
        targetVenueName={invitation.targetVenue.name}
        initialTitle={invitation.manuscript.title}
        initialAbstract={invitation.manuscript.abstract ?? ""}
        initialKeywords={invitation.manuscript.keywords ?? ""}
      />
    </main>
  );
}
