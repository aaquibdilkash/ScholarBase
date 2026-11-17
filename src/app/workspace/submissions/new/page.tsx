import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, FilePlus2 } from "lucide-react";

import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/db";
import { findOpenInvitationForAuthor } from "@/lib/publishing/invitations";
import { parseCoAuthors } from "@/lib/publishing/citations";
import { ManuscriptSubmissionForm } from "@/components/workspace/ManuscriptSubmissionForm";

const VENUE_TYPE_LABELS = {
  JOURNAL: "Journal",
  CONFERENCE: "Conference",
} as const;

/**
 * Entry point for a new submission.
 *
 * Three states, one route:
 *   - `?invitation=<id>` accepts an editor's invitation to extend an accepted
 *     conference paper. The id is resolved against the signed-in author, so a
 *     guessed id reveals nothing.
 *   - `?venue=<slug>` submits directly to a published venue. This is the link
 *     every public venue page points at — a journal must be able to receive its
 *     first paper without an invitation chain.
 *   - neither: a picker of venues the author may submit to.
 *
 * Editorial seats are excluded from the picker and refused here as well: the
 * person who decides a paper must not be the person who submitted it.
 */
export default async function NewSubmissionPage({
  searchParams,
}: {
  searchParams: Promise<{ invitation?: string; venue?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const { invitation: invitationId, venue: venueSlug } = await searchParams;

  if (invitationId) {
    const invitation = await findOpenInvitationForAuthor({
      invitationEventId: invitationId,
      authorId: user.id,
    });

    if (!invitation) return <InvitationClosed />;

    return (
      <main>
        <SubmissionHeader
          title={`Submit to ${invitation.targetVenue.name}`}
          description={`This creates a new submission at ${invitation.targetVenue.name}. Your conference paper at ${invitation.manuscript.venue.name} keeps its own status and acceptance record.`}
        />
        <ManuscriptSubmissionForm
          kind="invitation"
          invitationId={invitation.eventId}
          sourceTitle={invitation.manuscript.title}
          sourceVenueName={invitation.manuscript.venue.name}
          targetVenueName={invitation.targetVenue.name}
          initialTitle={invitation.manuscript.title}
          initialAbstract={invitation.manuscript.abstract ?? ""}
          initialKeywords={invitation.manuscript.keywords ?? ""}
          initialCoAuthors={parseCoAuthors(invitation.manuscript.coAuthors)}
        />
      </main>
    );
  }

  if (venueSlug) {
    const venue = await prisma.venue.findUnique({
      where: { slug: venueSlug },
      select: {
        id: true,
        slug: true,
        name: true,
        type: true,
        isPublished: true,
        isDemo: true,
      },
    });

    if (!venue || !venue.isPublished || venue.isDemo) {
      return (
        <main>
          <SubmissionHeader
            title="Submissions are closed"
            description="This venue is not accepting new manuscripts. Published venues open submissions from their own page."
          />
          <Link href="/workspace/submissions/new" className="sb-button-soft">
            Choose another venue
          </Link>
        </main>
      );
    }

    const seat = await prisma.editorialRole.findFirst({
      where: { userId: user.id, venueId: venue.id },
      select: { roleTitle: true },
    });

    if (seat) {
      return (
        <main>
          <SubmissionHeader
            title={`You edit ${venue.name}`}
            description={`You hold an editorial seat at this venue, so another editor must handle any manuscript you submit here. Ask a co-editor to submit on your behalf, or choose a venue where you have no seat.`}
          />
          <Link href="/workspace/submissions/new" className="sb-button-soft">
            Choose another venue
          </Link>
        </main>
      );
    }

    return (
      <main>
        <SubmissionHeader
          title={`Submit to ${venue.name}`}
          description={`You submit as the corresponding author. The editor is notified, and the ${venue.type === "JOURNAL" ? "article" : "paper"} keeps a status timeline you can follow here.`}
        />
        <ManuscriptSubmissionForm
          kind="direct"
          venueSlug={venue.slug}
          venueName={venue.name}
          venueType={venue.type}
        />
      </main>
    );
  }

  const [venues, seats] = await Promise.all([
    prisma.venue.findMany({
      where: { isPublished: true, isDemo: false },
      orderBy: [{ type: "asc" }, { name: "asc" }],
      select: { id: true, slug: true, name: true, type: true },
    }),
    prisma.editorialRole.findMany({
      where: { userId: user.id },
      select: { venueId: true },
    }),
  ]);

  const seatedVenueIds = new Set(seats.map((seat) => seat.venueId));
  const available = venues.filter((venue) => !seatedVenueIds.has(venue.id));

  return (
    <main>
      <SubmissionHeader
        title="New submission"
        description="Choose the venue that should receive your manuscript. Only venues that are publicly accepting submissions are listed."
      />

      {available.length === 0 ? (
        <div className="sb-card text-center">
          <FilePlus2
            className="mx-auto h-8 w-8 text-slate-400"
            aria-hidden="true"
          />
          <p className="mt-3 text-sm font-medium text-slate-900 dark:text-slate-100">
            No venue is open for direct submission right now.
          </p>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            If a conference editor invited you to extend your paper, use the
            link in your notifications or the invitation card on your
            submissions page.
          </p>
          <Link
            href="/workspace/submissions"
            className="sb-button-soft mt-4 inline-flex"
          >
            Back to your submissions
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {available.map((venue) => (
            <li key={venue.slug}>
              <Link
                href={`/workspace/submissions/new?venue=${venue.slug}`}
                className="sb-card sb-card-hover group flex h-full flex-col justify-between"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    {VENUE_TYPE_LABELS[venue.type]}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950 dark:text-slate-50">
                    {venue.name}
                  </p>
                </div>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-blue-700 dark:text-blue-300">
                  Start submission
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">
        Submitting creates a manuscript with you as the corresponding author.
        You can withdraw it before a decision is made.
        {seats.length > 0
          ? " Venues where you hold an editorial seat are not listed: another editor must handle any manuscript you submit there."
          : ""}
      </p>
    </main>
  );
}

function SubmissionHeader({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <header className="mb-6">
      <h1 className="sb-heading text-2xl break-words">{title}</h1>
      <p className="sb-subtitle mt-2 max-w-2xl text-sm">{description}</p>
    </header>
  );
}

function InvitationClosed() {
  return (
    <main>
      <SubmissionHeader
        title="Submit an extended version"
        description="The invitation id is checked against your account and against the conference paper it belongs to."
      />
      <div className="sb-card">
        <p className="text-sm text-slate-700 dark:text-slate-300">
          This invitation is not open. It may have been declined, already used,
          or withdrawn by the conference.
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
