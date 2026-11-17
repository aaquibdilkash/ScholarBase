"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";

import {
  createVenueAction,
  deleteVenueAction,
  grantEditorialRoleAction,
  revokeEditorialRoleAction,
  setVenuePublishedAction,
  type VenueActionResult,
} from "@/app/actions/publishing";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Select } from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import {
  MAX_VENUE_NAME,
  MAX_VENUE_SLUG,
  normalizeVenueSlug,
} from "@/lib/publishing/slug";

export type VenueAdminRole = {
  id: string;
  roleTitle: string;
  userName: string | null;
  userEmail: string;
};

export type VenueAdminRow = {
  id: string;
  slug: string;
  name: string;
  type: "JOURNAL" | "CONFERENCE";
  isPublished: boolean;
  isDemo: boolean;
  issn: string | null;
  eissn: string | null;
  editorName: string | null;
  boardCount: number;
  manuscriptCount: number;
  roles: VenueAdminRole[];
};

const EMPTY_RESULT: VenueActionResult = { success: false, message: "" };
const ROLE_OPTIONS = [
  { value: "EDITOR_IN_CHIEF", label: "Editor-in-Chief" },
  { value: "TRACK_CHAIR", label: "Track Chair" },
  { value: "ASSOC_EDITOR", label: "Associate Editor" },
] as const;

function SubmitButton({
  children,
  className = "sb-button-primary",
  pendingLabel = "Saving…",
}: {
  children: React.ReactNode;
  className?: string;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();

  return (
    <button type="submit" disabled={pending} className={className}>
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {pendingLabel}
        </span>
      ) : (
        children
      )}
    </button>
  );
}

function ResultMessage({ state }: { state: VenueActionResult }) {
  if (!state.message) return null;

  if (state.success) {
    return (
      <p
        role="status"
        className="rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-200"
      >
        {state.message}
      </p>
    );
  }

  return (
    <p
      role="alert"
      className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300"
    >
      {state.message}
    </p>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return (
    <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
      {value}/{max} characters
    </div>
  );
}

function CreateVenueCard() {
  const [state, formAction] = useActionState(createVenueAction, EMPTY_RESULT);
  const { toast } = useToast();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [type, setType] = useState<"JOURNAL" | "CONFERENCE">("JOURNAL");
  const [slugTouched, setSlugTouched] = useState(false);

  // A venue slug is a permanent public URL (`/sbj/<slug>`), so it is derived
  // from the name until the admin edits it deliberately.
  useEffect(() => {
    if (!slugTouched) setSlug(normalizeVenueSlug(name));
  }, [name, slugTouched]);

  useEffect(() => {
    if (!state.success) return;
    setName("");
    setSlug("");
    setType("JOURNAL");
    setSlugTouched(false);
  }, [state]);

  useEffect(() => {
    if (!state.message) return;
    toast({
      title: state.success ? "Venue created" : "Could not create venue",
      description: state.message,
      variant: state.success ? "default" : "destructive",
    });
  }, [state, toast]);

  return (
    <section className="sb-card">
      <h2 className="sb-heading text-lg">Create a venue</h2>
      <p className="sb-subtitle mt-1 text-sm">
        A venue is one journal or one conference. It stays unpublished — and out of
        the sitemap — until it has an editor, aims, and a board.
      </p>

      <form action={formAction} className="mt-5 space-y-4">
        <div>
          <label htmlFor="venue-name" className="sb-label inline-flex items-center gap-1.5">
            Name
            <InfoTooltip message="The title readers will see, and the title that must match your ISSN application." />
          </label>
          <input
            id="venue-name"
            name="name"
            type="text"
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_VENUE_NAME}
            className="sb-input"
            placeholder="Indian Journal of Optics"
          />
          <Counter value={name.length} max={MAX_VENUE_NAME} />
        </div>

        <div>
          <label htmlFor="venue-type" className="sb-label inline-flex items-center gap-1.5">
            Type
            <InfoTooltip message="Journals accept journal submissions; conferences can accept papers to proceedings and transfer them to a journal." />
          </label>
          <Select
            id="venue-type"
            name="type"
            className="sb-select"
            value={type}
            onChange={(event) => setType(event.target.value as "JOURNAL" | "CONFERENCE")}
          >
            <option value="JOURNAL">Journal</option>
            <option value="CONFERENCE">Conference</option>
          </Select>
        </div>

        <div>
          <label htmlFor="venue-slug" className="sb-label inline-flex items-center gap-1.5">
            Slug
            <InfoTooltip message="Permanent URL segment. Changing it after launch breaks citations and requires notifying the ISSN centre." />
          </label>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
              {type === "JOURNAL" ? "/sbj/" : "/sbc/"}
            </span>
            <input
              id="venue-slug"
              name="slug"
              type="text"
              required
              value={slug}
              onChange={(event) => {
                setSlugTouched(true);
                setSlug(normalizeVenueSlug(event.target.value));
              }}
              maxLength={MAX_VENUE_SLUG}
              className="sb-input"
              placeholder="indian-journal-of-optics"
            />
          </div>
          <Counter value={slug.length} max={MAX_VENUE_SLUG} />
        </div>

        <ResultMessage state={state} />

        <SubmitButton>Create venue</SubmitButton>
      </form>
    </section>
  );
}

function VenueCard({ venue }: { venue: VenueAdminRow }) {
  const [publishState, publishAction] = useActionState(setVenuePublishedAction, EMPTY_RESULT);
  const [roleState, roleAction] = useActionState(grantEditorialRoleAction, EMPTY_RESULT);
  const [revokeState, revokeAction] = useActionState(revokeEditorialRoleAction, EMPTY_RESULT);
  const [deleteState, deleteAction] = useActionState(deleteVenueAction, EMPTY_RESULT);
  const [roles, setRoles] = useState(venue.roles);
  const [removed, setRemoved] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (roleState.success) setRoles(venue.roles);
    if (!roleState.success && roleState.message) setRoles(venue.roles);
    if (revokeState.success) setRoles(venue.roles);
    if (!revokeState.success && revokeState.message) setRoles(venue.roles);
  }, [roleState, revokeState, venue.roles]);

  useEffect(() => {
    for (const [state, successTitle, errorTitle] of [
      [publishState, "Venue status updated", "Could not update venue status"],
      [roleState, "Editorial role granted", "Could not grant editorial role"],
      [revokeState, "Editorial role revoked", "Could not revoke editorial role"],
      [deleteState, "Venue deleted", "Could not delete venue"],
    ] as const) {
      if (!state.message) continue;
      toast({
        title: state.success ? successTitle : errorTitle,
        description: state.message,
        variant: state.success ? "default" : "destructive",
      });
    }
  }, [deleteState, publishState, roleState, revokeState, toast]);

  useEffect(() => {
    if (deleteState.success) setRemoved(true);
  }, [deleteState.success]);

  const path = `/${venue.type === "JOURNAL" ? "sbj" : "sbc"}/${venue.slug}`;
  const identifier = venue.issn ?? venue.eissn;

  if (removed) return null;

  return (
    <article className="sb-card">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="sb-heading text-lg">{venue.name}</h3>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
            {venue.isPublished ? <Link href={path} className="underline hover:text-slate-900 dark:hover:text-white">{path}</Link> : path}
            {identifier ? ` · ISSN ${identifier}` : " · no ISSN yet"}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full border border-slate-500/30 bg-slate-500/10 px-2 py-0.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
            {venue.type === "JOURNAL" ? "Journal" : "Conference"}
          </span>
          <span
            className={
              venue.isPublished
                ? "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300"
                : "rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs font-semibold text-amber-700 dark:text-amber-300"
            }
          >
            {venue.isPublished ? "Published" : "Draft"}
          </span>
          <Link
            href={`/workspace/editorial/settings?venue=${encodeURIComponent(venue.id)}`}
            className="sb-button-soft inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs"
            aria-label={`Edit ${venue.name}`}
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Link>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-slate-600 dark:text-slate-300">Editor</dt>
          <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">
            {venue.editorName ?? (() => {
              const editor = roles.find((role) => role.roleTitle === "EDITOR_IN_CHIEF");
              return editor?.userName ?? editor?.userEmail ?? "Not set";
            })()}
          </dd>
        </div>
        <div>
          <dt className="text-slate-600 dark:text-slate-300">Board</dt>
          <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{venue.boardCount}</dd>
        </div>
        <div>
          <dt className="text-slate-600 dark:text-slate-300">Submissions</dt>
          <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{venue.manuscriptCount}</dd>
        </div>
        <div>
          <dt className="text-slate-600 dark:text-slate-300">e-ISSN</dt>
          <dd className="mt-1 font-medium text-slate-900 dark:text-slate-100">{venue.eissn ?? "—"}</dd>
        </div>
      </dl>

      <form action={publishAction} className="mt-4 mb-4">
        <input type="hidden" name="venueId" value={venue.id} />
        <input type="hidden" name="published" value={venue.isPublished ? "false" : "true"} />
        <SubmitButton
          className="sb-button-soft"
          pendingLabel={venue.isPublished ? "Unpublishing…" : "Publishing…"}
        >
          {venue.isPublished ? "Unpublish" : "Publish"}
        </SubmitButton>
      </form>
      <ResultMessage state={publishState} />

      {!venue.isPublished && (
        <form
          action={deleteAction}
          className="mt-3"
          onSubmit={(event) => {
            if (!window.confirm(`Delete the empty draft venue “${venue.name}”? This cannot be undone.`)) {
              event.preventDefault();
            }
          }}
        >
          <input type="hidden" name="venueId" value={venue.id} />
          <SubmitButton className="inline-flex items-center gap-2 border-red-500/40 text-red-300 hover:border-red-400 hover:text-red-200" pendingLabel="Deleting…">
            <Trash2 className="h-4 w-4" /> Delete draft
          </SubmitButton>
        </form>
      )}
      <ResultMessage state={deleteState} />

      <div className="mt-6 border-t border-[var(--card-border)] pt-4">
        <h4 className="text-base font-semibold text-slate-900 dark:text-slate-100">Editorial roles</h4>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Roles decide who can assign reviewers, decide, and publish at this venue.
        </p>

        {roles.length === 0 ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Nobody holds a role yet.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {roles.map((role) => (
              <li
                key={role.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--card-border)] px-3 py-2.5 text-sm text-slate-900 dark:text-slate-100"
              >
                <span>
                  <span className="font-medium">{role.userName ?? role.userEmail}</span>
                  <span className="text-slate-600 dark:text-slate-300">
                    {" · "}
                    {role.roleTitle.replace(/_/g, " ").toLowerCase()}
                  </span>
                </span>
                <form
                  action={revokeAction}
                  onSubmit={() => setRoles((current) => current.filter((item) => item.id !== role.id))}
                >
                  <input type="hidden" name="roleId" value={role.id} />
                  <SubmitButton
                    className="sb-button-soft px-2 py-1 text-xs"
                    pendingLabel="Revoking…"
                  >
                    Revoke
                  </SubmitButton>
                </form>
              </li>
            ))}
          </ul>
        )}

        <form
          action={roleAction}
          onSubmit={(event) => {
            const data = new FormData(event.currentTarget);
            const email = String(data.get("email") ?? "").trim().toLowerCase();
            const roleTitle = String(data.get("roleTitle") ?? "");
            if (!email || !roleTitle) return;
            setRoles((current) => [
              ...current.filter((role) => !(role.userEmail === email && role.roleTitle === roleTitle)),
              {
                id: `optimistic-${venue.id}-${email}-${roleTitle}`,
                roleTitle,
                userName: null,
                userEmail: email,
              },
            ]);
          }}
          className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto_auto]"
        >
          <input type="hidden" name="venueId" value={venue.id} />
          <div>
            <label htmlFor={`role-email-${venue.id}`} className="sb-label">
              Account email
            </label>
            <input
              id={`role-email-${venue.id}`}
              name="email"
              type="email"
              required
              className="sb-input"
              placeholder="editor@institution.ac.in"
            />
          </div>
          <div>
            <label htmlFor={`role-title-${venue.id}`} className="sb-label">
              Role
            </label>
            <Select
              id={`role-title-${venue.id}`}
              name="roleTitle"
              className="sb-select"
              defaultValue="EDITOR_IN_CHIEF"
            >
              {ROLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-end">
            <SubmitButton className="sb-button-soft" pendingLabel="Granting…">
              Grant
            </SubmitButton>
          </div>
        </form>
        <ResultMessage state={roleState} />
      </div>
    </article>
  );
}

export function VenueAdminPanel({ venues }: { venues: VenueAdminRow[] }) {
  return (
    <div className="space-y-6">
      <CreateVenueCard />

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="sb-heading text-lg">Venues</h2>
          <Link href="/workspace/editorial/settings" className="sb-button-soft">Edit venue information</Link>
        </div>
        {venues.length === 0 ? (
          <p className="sb-card text-sm text-slate-500 dark:text-slate-400">
            No venues yet. Create the first journal above.
          </p>
        ) : (
          venues.map((venue) => <VenueCard key={venue.id} venue={venue} />)
        )}
      </section>
    </div>
  );
}
