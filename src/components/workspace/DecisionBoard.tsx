import Link from "next/link";
import type { EditorialRoleTitle, ManuscriptStatus, VenueType } from "@prisma/client";

import { formatDate } from "@/utils/date";
import {
  BOARD_COLUMNS,
  QUICK_MOVE_LABELS,
  quickBoardMoves,
} from "@/lib/publishing/board";
import { canEditorSetStatus } from "@/lib/publishing/permissions";
import { ManuscriptStatusBadge } from "@/components/workspace/ManuscriptStatusBadge";
import { BoardMoveForm } from "@/components/workspace/BoardMoveForm";

/**
 * Decision board: one column per stage, one card per paper.
 *
 * The board does not own any workflow rule. Columns come from
 * `BOARD_COLUMNS`, and a card's quick moves come from `quickBoardMoves`, which
 * reads the same transition table and capability predicates as the review
 * workspace. Adding an edge in one place cannot bypass the other.
 *
 * Publication and rejection are links, not drops: both need facts (a citation
 * locator, a decision letter) that a card cannot collect.
 */

export type BoardCard = {
  id: string;
  title: string;
  status: ManuscriptStatus;
  round: number;
  updatedAt: Date;
  doi: string | null;
  authorName: string | null;
  reviewTotal: number;
  reviewCompleted: number;
};

export type BoardVenueGroup = {
  venueId: string;
  venueName: string;
  venueType: VenueType;
  roles: readonly EditorialRoleTitle[];
  cards: BoardCard[];
};

function roundLabel(round: number): string {
  return round === 0 ? "Initial submission" : `Revision ${round}`;
}

function BoardCardView({
  card,
  venueType,
  roles,
  isAdmin,
}: {
  card: BoardCard;
  venueType: VenueType;
  roles: readonly EditorialRoleTitle[];
  isAdmin: boolean;
}) {
  const actor = { roles, isAdmin };
  const moves = quickBoardMoves(actor, card.status, venueType);
  const canPublish = canEditorSetStatus(actor, "PUBLISHED");

  return (
    <article className="rounded-xl border border-[var(--card-border)] bg-[var(--card-bg)] p-3">
      <Link
        className="block text-sm font-semibold text-slate-900 underline-offset-2 hover:underline dark:text-slate-100"
        href={`/workspace/editorial/manuscripts/${card.id}`}
      >
        {card.title}
      </Link>
      <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
        {card.authorName ?? "Author not listed"} · {roundLabel(card.round)}
      </p>

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <ManuscriptStatusBadge status={card.status} />
        {card.reviewTotal > 0 ? (
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            {card.reviewCompleted}/{card.reviewTotal} reports
          </span>
        ) : null}
        {card.doi ? (
          <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">
            DOI
          </span>
        ) : null}
      </div>

      <p className="mt-2 text-[11px] text-slate-500 dark:text-slate-400">
        Updated {formatDate(card.updatedAt)}
      </p>

      {moves.length > 0 || card.status === "ACCEPTED_JOURNAL" || card.status === "ACCEPTED_PROCEDINGS" ? (
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {moves.map((status) => (
            <BoardMoveForm
              key={status}
              label={QUICK_MOVE_LABELS[status] ?? status}
              manuscriptId={card.id}
              toStatus={status}
            />
          ))}
          {card.status === "ACCEPTED_JOURNAL" || card.status === "ACCEPTED_PROCEDINGS" ? (
            <Link
              className="text-[11px] font-semibold text-blue-700 underline-offset-2 hover:underline dark:text-blue-300"
              href={
                canPublish
                  ? "/workspace/editorial#publication"
                  : `/workspace/editorial/manuscripts/${card.id}`
              }
            >
              {canPublish ? "Publish →" : "Open →"}
            </Link>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export function DecisionBoard({
  venues,
  isAdmin,
}: {
  venues: BoardVenueGroup[];
  isAdmin: boolean;
}) {
  return (
    <div className="space-y-8">
      {venues.map((venue) => {
        const open = venue.cards.filter((card) =>
          ["SUBMITTED", "UNDER_REVIEW", "REVISION_REQUIRED"].includes(card.status),
        ).length;

        return (
          <section key={venue.venueId} aria-labelledby={`board-${venue.venueId}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2
                id={`board-${venue.venueId}`}
                className="sb-heading text-lg"
              >
                {venue.venueName}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {venue.venueType === "JOURNAL" ? "Journal" : "Conference"} ·{" "}
                {open} open {open === 1 ? "paper" : "papers"}
              </p>
            </div>

            <div className="mt-3 flex snap-x gap-3 overflow-x-auto pb-2">
              {BOARD_COLUMNS.map((column) => {
                const cards = venue.cards.filter((card) =>
                  column.statuses.includes(card.status),
                );

                return (
                  <div
                    className="flex min-w-[15rem] flex-1 snap-start flex-col rounded-2xl border border-[var(--card-border)] bg-slate-500/5 p-2.5"
                    key={column.key}
                  >
                    <div className="flex items-baseline justify-between gap-2 px-1">
                      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-300">
                        {column.label}
                      </h3>
                      <span className="rounded-full border border-[var(--card-border)] px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 dark:text-slate-400">
                        {cards.length}
                      </span>
                    </div>
                    <p className="px-1 text-[11px] text-slate-500 dark:text-slate-400">
                      {column.hint}
                    </p>

                    <div className="mt-2 space-y-2">
                      {cards.length === 0 ? (
                        <p className="rounded-xl border border-dashed border-[var(--card-border)] p-3 text-[11px] text-slate-500 dark:text-slate-400">
                          Nothing here.
                        </p>
                      ) : (
                        cards.map((card) => (
                          <BoardCardView
                            card={card}
                            isAdmin={isAdmin}
                            key={card.id}
                            roles={venue.roles}
                            venueType={venue.venueType}
                          />
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
