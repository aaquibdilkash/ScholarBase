"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus, Trash2 } from "lucide-react";

import {
  updateVenueSettingsAction,
  type VenueActionResult,
} from "@/app/actions/publishing";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Editor } from "@/components/ui/Editor";
import { useToast } from "@/components/ui/Toast";
import { useFormDraft } from "@/hooks/useFormDraft";
import {
  MAX_VENUE_BOARD_AFFILIATION,
  MAX_VENUE_BOARD_NAME,
  MAX_VENUE_BOARD_ORCID,
  MAX_VENUE_BOARD_ROLE,
  MAX_VENUE_CONTACT_EMAIL,
  MAX_VENUE_EDITOR_AFFILIATION,
  MAX_VENUE_EDITOR_NAME,
  MAX_VENUE_FREQUENCY,
  MAX_VENUE_RICH_TEXT,
} from "@/lib/publishing/constants";
import { MAX_VENUE_NAME } from "@/lib/publishing/slug";

type BoardRow = { name: string; roleTitle: string; affiliation: string; orcid: string };
type VenueDraft = {
  name: string;
  editorName: string;
  editorAffiliation: string;
  frequency: string;
  contactEmail: string;
  aimsAndScope: string;
  authorGuidelines: string;
  peerReviewPolicy: string;
  ethicsPolicy: string;
  board: BoardRow[];
};
export type VenueSettingsValues = {
  id: string;
  name: string;
  type: "JOURNAL" | "CONFERENCE";
  editorName: string;
  editorAffiliation: string;
  frequency: string;
  contactEmail: string;
  aimsAndScope: string;
  authorGuidelines: string;
  peerReviewPolicy: string;
  ethicsPolicy: string;
  board: BoardRow[];
};

const EMPTY: VenueActionResult = { success: false, message: "" };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="sb-button-primary">
      {pending ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Saving…</span> : "Save venue settings"}
    </button>
  );
}

function Counter({ value, max }: { value: number; max: number }) {
  return <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{value}/{max} characters</p>;
}

function TextField({
  id, name, label, value, onChange, maxLength, type = "text", tip, required = false,
}: {
  id: string; name: string; label: string; value: string; onChange: (value: string) => void;
  maxLength: number; type?: string; tip: string; required?: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="sb-label inline-flex items-center gap-1.5">{label}<InfoTooltip message={tip} /></label>
      <input id={id} name={name} type={type} value={value} required={required} maxLength={maxLength} onChange={(event) => onChange(event.target.value)} className="sb-input" />
      <Counter value={value.length} max={maxLength} />
    </div>
  );
}

export function VenueSettingsForm({ venue }: { venue: VenueSettingsValues }) {
  const [state, formAction] = useActionState(updateVenueSettingsAction, EMPTY);
  const { toast } = useToast();
  const draftKey = `draft_venue_settings_${venue.id}`;
  const [draft, updateDraftField, , isRestored] = useFormDraft<VenueDraft>(draftKey, {
    name: venue.name,
    editorName: venue.editorName,
    editorAffiliation: venue.editorAffiliation,
    frequency: venue.frequency,
    contactEmail: venue.contactEmail,
    aimsAndScope: venue.aimsAndScope,
    authorGuidelines: venue.authorGuidelines,
    peerReviewPolicy: venue.peerReviewPolicy,
    ethicsPolicy: venue.ethicsPolicy,
    board: venue.board,
  });
  const board = Array.isArray(draft.board) ? draft.board : [];

  useEffect(() => {
    if (!state.message) return;
    toast({
      title: state.success ? "Venue settings saved" : "Could not save venue settings",
      description: state.message,
      variant: state.success ? "default" : "destructive",
    });
  }, [state, toast]);

  useEffect(() => {
    if (!state.success) return;
    try {
      localStorage.removeItem(draftKey);
    } catch {
      // Draft cleanup is best effort; the saved server state remains canonical.
    }
  }, [draftKey, state.success]);

  const updateBoard = (index: number, key: keyof BoardRow, value: string) => {
    updateDraftField(
      "board",
      board.map((row, rowIndex) => rowIndex === index ? { ...row, [key]: value } : row),
    );
  };

  return (
    <form action={formAction} className="space-y-8">
      <input type="hidden" name="venueId" value={venue.id} />
      <section className="sb-card space-y-4">
        <div><h2 className="sb-heading text-lg">{venue.name}</h2><p className="mt-1 text-base text-slate-300 dark:text-slate-300">{venue.type === "JOURNAL" ? "Journal" : "Conference"} profile and publishing metadata.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id={`${venue.id}-name`} name="name" label="Venue name" value={draft.name} onChange={(value) => updateDraftField("name", value)} maxLength={MAX_VENUE_NAME} required tip="The public name of the journal or conference. Changing it does not change the permanent URL." />
          <TextField id={`${venue.id}-editor`} name="editorName" label="Editor-in-chief" value={draft.editorName} onChange={(value) => updateDraftField("editorName", value)} maxLength={MAX_VENUE_EDITOR_NAME} required tip="The named editor shown in public metadata and required before publishing." />
          <TextField id={`${venue.id}-affiliation`} name="editorAffiliation" label="Editor affiliation" value={draft.editorAffiliation} onChange={(value) => updateDraftField("editorAffiliation", value)} maxLength={MAX_VENUE_EDITOR_AFFILIATION} tip="The editor's institution or department." />
          <TextField id={`${venue.id}-frequency`} name="frequency" label="Publication frequency" value={draft.frequency} onChange={(value) => updateDraftField("frequency", value)} maxLength={MAX_VENUE_FREQUENCY} tip="For example, quarterly, biannual, or annual." />
          <TextField id={`${venue.id}-contact`} name="contactEmail" label="Contact email" value={draft.contactEmail} onChange={(value) => updateDraftField("contactEmail", value)} maxLength={MAX_VENUE_CONTACT_EMAIL} type="email" tip="Public editorial contact address." />
        </div>
      </section>

      <section className="sb-card space-y-5">
        <div><h2 className="sb-heading text-lg">Policies and scope</h2><p className="mt-1 text-base text-slate-300 dark:text-slate-300">These fields are sanitized before storage and shown on the public venue pages.</p></div>
        {([
          ["aimsAndScope", "Aims and scope", draft.aimsAndScope, "What research the venue accepts and its scholarly focus."],
          ["authorGuidelines", "Author guidelines", draft.authorGuidelines, "Submission requirements and formatting guidance for authors."],
          ["peerReviewPolicy", "Peer-review policy", draft.peerReviewPolicy, "How submissions are assessed and decisions are made."],
          ["ethicsPolicy", "Ethics policy", draft.ethicsPolicy, "Research integrity, conflicts, authorship, and misconduct policy."],
        ] as const).map(([key, label, value, tip]) => (
          <div key={key}>
            <label className="sb-label inline-flex items-center gap-1.5">{label}<InfoTooltip message={tip} /></label>
            <Editor value={value} onChange={(nextValue) => updateDraftField(key, nextValue)} maxLength={MAX_VENUE_RICH_TEXT} />
            <input type="hidden" name={key} value={value} />
          </div>
        ))}
      </section>

      <section className="sb-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="sb-heading text-lg">Editorial board</h2><p className="mt-1 text-base text-slate-300 dark:text-slate-300">{board.length} member{board.length === 1 ? "" : "s"} · Add the structured public board used by the publish gate and ISSN metadata.</p></div><button type="button" className="sb-button-soft inline-flex items-center gap-2" onClick={() => { updateDraftField("board", [...board, { name: "", roleTitle: "", affiliation: "", orcid: "" }]); toast({ title: "Board member row added", description: "Complete the row and save venue settings." }); }}><Plus className="h-4 w-4" />Add member</button></div>
        <div className="space-y-4">
          {board.map((row, index) => (
            <div key={index} className="rounded-lg border border-[var(--card-border)] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField id={`${venue.id}-board-name-${index}`} name="boardName" label="Name" value={row.name} onChange={(value) => updateBoard(index, "name", value)} maxLength={MAX_VENUE_BOARD_NAME} required tip="The board member's public name." />
                <TextField id={`${venue.id}-board-role-${index}`} name="boardRoleTitle" label="Role" value={row.roleTitle} onChange={(value) => updateBoard(index, "roleTitle", value)} maxLength={MAX_VENUE_BOARD_ROLE} required tip="For example, Associate Editor or Advisory Board Member." />
                <TextField id={`${venue.id}-board-affiliation-${index}`} name="boardAffiliation" label="Affiliation" value={row.affiliation} onChange={(value) => updateBoard(index, "affiliation", value)} maxLength={MAX_VENUE_BOARD_AFFILIATION} tip="Institution or department, if available." />
                <TextField id={`${venue.id}-board-orcid-${index}`} name="boardOrcid" label="ORCID" value={row.orcid} onChange={(value) => updateBoard(index, "orcid", value)} maxLength={MAX_VENUE_BOARD_ORCID} tip="Optional ORCID identifier." />
              </div>
              <button type="button" className="mt-3 inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-300" onClick={() => { updateDraftField("board", board.filter((_, rowIndex) => rowIndex !== index)); toast({ title: "Board member removed from draft", description: "Save venue settings to apply this change." }); }}><Trash2 className="h-3.5 w-3.5" />Remove member</button>
            </div>
          ))}
          {board.length === 0 && <p className="rounded-lg border border-dashed border-[var(--card-border)] p-4 text-sm text-slate-500 dark:text-slate-400">No board members yet. Add at least one before publishing.</p>}
        </div>
      </section>

      {state.message && <p role={state.success ? "status" : "alert"} className={state.success ? "rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-200" : "rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300"}>{state.message}</p>}
      {!isRestored && <p className="text-xs text-slate-500 dark:text-slate-400">Restoring your draft…</p>}
      <SubmitButton />
    </form>
  );
}

export function VenueSettingsPanel({
  venues,
  initialVenueId,
}: {
  venues: VenueSettingsValues[];
  initialVenueId?: string;
}) {
  const [selectedId, setSelectedId] = useState(
    initialVenueId && venues.some((venue) => venue.id === initialVenueId)
      ? initialVenueId
      : venues[0]?.id ?? "",
  );
  const selected = venues.find((venue) => venue.id === selectedId) ?? venues[0];

  if (!selected) return null;

  return (
    <div className="space-y-5">
      {venues.length > 1 && (
        <div className="sb-card">
          <label htmlFor="venue-settings-select" className="sb-label">
            Venue
          </label>
          <select
            id="venue-settings-select"
            value={selected.id}
            onChange={(event) => setSelectedId(event.target.value)}
            className="sb-input"
          >
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name} · {venue.type === "JOURNAL" ? "Journal" : "Conference"}
              </option>
            ))}
          </select>
        </div>
      )}
      <VenueSettingsForm key={selected.id} venue={selected} />
    </div>
  );
}
