"use client";

import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, Plus, Trash2 } from "lucide-react";

import {
  updateVenueSettingsAction,
  type VenueActionResult,
} from "@/app/actions/publishing";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { TextField } from "@/components/ui/TextField";
import { Select } from "@/components/ui/Select";
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
  VENUE_STARTER_TEMPLATES,
} from "@/lib/publishing/constants";
import { MAX_VENUE_NAME } from "@/lib/publishing/slug";
import { ConferenceEditionForm } from "@/components/workspace/ConferenceEditionForm";
import { ConferenceEditionStatusForm } from "@/components/workspace/ConferenceEditionStatusForm";
import { ConferenceProgramForm } from "@/components/workspace/ConferenceProgramForm";
import { JournalIssueForm, JournalIssueStatusForm } from "@/components/workspace/JournalIssueForm";
import { ContentImageUploadField } from "@/components/upload/ContentImageUploadField";

type BoardRow = { name: string; roleTitle: string; affiliation: string; orcid: string };
type VenueDraft = {
  name: string;
  coverImageUrl: string;
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
  coverImageUrl?: string | null;
  editorName: string;
  editorAffiliation: string;
  frequency: string;
  contactEmail: string;
  aimsAndScope: string;
  authorGuidelines: string;
  peerReviewPolicy: string;
  ethicsPolicy: string;
  board: BoardRow[];
  editions?: Array<{
    id: string;
    slug: string;
    label: string;
    coverImageUrl?: string | null;
    year: number;
    term: string | null;
    status: string;
    volume: number | null;
    isbn: string | null;
    isPublished: boolean;
    startsAt?: Date | string | null;
    endsAt?: Date | string | null;
    location?: string | null;
    timezone?: string | null;
    websiteUrl?: string | null;
    proceedingsDoi?: string | null;
    cfpOpenAt?: Date | string | null;
    submissionDeadline?: Date | string | null;
    notificationAt?: Date | string | null;
    cameraReadyAt?: Date | string | null;
    programItems?: Array<{ id: string; title: string; type: string; startsAt: Date | string | null; room: string | null; speakers: string | null }>;
  }>;
  journalIssues?: Array<{
    id: string;
    volume: number;
    number: number;
    title: string | null;
    description: string | null;
    publicationDate: Date | string | null;
    coverImageUrl: string | null;
    doi: string | null;
    status: string;
    isPublished: boolean;
  }>;
};

const EMPTY: VenueActionResult = { success: false, message: "" };

function SubmitButton({ label = "Save venue settings" }: { label?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="sb-button-primary">
      {pending ? <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" />Saving…</span> : label}
    </button>
  );
}

function FieldHeader({
  label,
  tip,
  showDefault = false,
  onUseDefault,
}: {
  label: string;
  tip: string;
  showDefault?: boolean;
  onUseDefault?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label className="sb-label inline-flex items-center gap-1.5">
        {label}
        <InfoTooltip message={tip} />
      </label>
      {showDefault && onUseDefault ? (
        <button
          type="button"
          onClick={onUseDefault}
          className="shrink-0 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
        >
          Use default
        </button>
      ) : null}
    </div>
  );
}

export function VenueSettingsForm({ venue, section = "general" }: { venue: VenueSettingsValues; section?: "general" | "policies" }) {
  const [state, formAction] = useActionState(updateVenueSettingsAction, EMPTY);
  const { toast } = useToast();
  const draftKey = `draft_venue_settings_${venue.id}`;
  const [draft, updateDraftField, , isRestored] = useFormDraft<VenueDraft>(draftKey, {
    name: venue.name,
    coverImageUrl: venue.coverImageUrl ?? "",
    editorName: venue.editorName,
    editorAffiliation: venue.editorAffiliation,
    frequency: venue.frequency,
    contactEmail: venue.contactEmail,
    aimsAndScope: venue.aimsAndScope || VENUE_STARTER_TEMPLATES.aimsAndScope,
    authorGuidelines: venue.authorGuidelines || VENUE_STARTER_TEMPLATES.authorGuidelines,
    peerReviewPolicy: venue.peerReviewPolicy || VENUE_STARTER_TEMPLATES.peerReviewPolicy,
    ethicsPolicy: venue.ethicsPolicy || VENUE_STARTER_TEMPLATES.ethicsPolicy,
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
      {section === "policies" && <>
        <input type="hidden" name="name" value={draft.name} /><input type="hidden" name="coverImageUrl" value={draft.coverImageUrl} /><input type="hidden" name="editorName" value={draft.editorName} /><input type="hidden" name="editorAffiliation" value={draft.editorAffiliation} /><input type="hidden" name="frequency" value={draft.frequency} /><input type="hidden" name="contactEmail" value={draft.contactEmail} />
        {board.map((row, index) => <span key={`hidden-board-${index}`}><input type="hidden" name="boardName" value={row.name} /><input type="hidden" name="boardRoleTitle" value={row.roleTitle} /><input type="hidden" name="boardAffiliation" value={row.affiliation} /><input type="hidden" name="boardOrcid" value={row.orcid} /></span>)}
      </>}
      {section === "general" && <section className="sb-card space-y-4">
        <div><h2 className="sb-heading text-lg">{venue.name}</h2><p className="mt-1 text-base text-slate-600 dark:text-slate-300">{venue.type === "JOURNAL" ? "Journal" : "Conference"} profile and publishing metadata.</p></div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id={`${venue.id}-name`} name="name" label="Venue name" value={draft.name} onValueChange={(value) => updateDraftField("name", value)} maxLength={MAX_VENUE_NAME} required tip="The public name of the journal or conference. Changing it does not change the permanent URL." />
          <TextField id={`${venue.id}-editor`} name="editorName" label="Editor-in-chief" value={draft.editorName} onValueChange={(value) => updateDraftField("editorName", value)} maxLength={MAX_VENUE_EDITOR_NAME} required tip="The named editor shown in public metadata and required before publishing." />
          <TextField id={`${venue.id}-affiliation`} name="editorAffiliation" label="Editor affiliation" value={draft.editorAffiliation} onValueChange={(value) => updateDraftField("editorAffiliation", value)} maxLength={MAX_VENUE_EDITOR_AFFILIATION} tip="The editor's institution or department." />
          <TextField id={`${venue.id}-frequency`} name="frequency" label="Publication frequency" value={draft.frequency} onValueChange={(value) => updateDraftField("frequency", value)} maxLength={MAX_VENUE_FREQUENCY} tip="For example, quarterly, biannual, or annual." />
          <TextField id={`${venue.id}-contact`} name="contactEmail" label="Contact email" value={draft.contactEmail} onValueChange={(value) => updateDraftField("contactEmail", value)} maxLength={MAX_VENUE_CONTACT_EMAIL} type="email" tip="Public editorial contact address." />
        </div>
        <div><label className="sb-label inline-flex items-center gap-1.5">Venue cover image <InfoTooltip message="Optional cover image used on the public journal or conference landing page." /></label><ContentImageUploadField kind="venue-cover" value={draft.coverImageUrl} onChange={(value) => updateDraftField("coverImageUrl", value)} buttonLabel="Upload venue cover" /><input type="hidden" name="coverImageUrl" value={draft.coverImageUrl} /></div>
      </section>}

      {section === "general" && <>
        {(["aimsAndScope", "authorGuidelines", "peerReviewPolicy", "ethicsPolicy"] as const).map((key) => <input key={key} type="hidden" name={key} value={draft[key]} />)}
      </>}

      {section === "policies" && <section className="sb-card space-y-5">
        <div><h2 className="sb-heading text-lg">Policies and scope</h2><p className="mt-1 text-base text-slate-600 dark:text-slate-300">These fields are sanitized before storage and shown on the public venue pages.</p></div>
        {([
          ["aimsAndScope", "Aims and scope", draft.aimsAndScope, "What research the venue accepts and its scholarly focus.", VENUE_STARTER_TEMPLATES.aimsAndScope],
          ["authorGuidelines", "Author guidelines", draft.authorGuidelines, "Submission requirements and formatting guidance for authors.", VENUE_STARTER_TEMPLATES.authorGuidelines],
          ["peerReviewPolicy", "Peer-review policy", draft.peerReviewPolicy, "How submissions are assessed and decisions are made.", VENUE_STARTER_TEMPLATES.peerReviewPolicy],
          ["ethicsPolicy", "Ethics policy", draft.ethicsPolicy, "Research integrity, conflicts, authorship, and misconduct policy.", VENUE_STARTER_TEMPLATES.ethicsPolicy],
        ] as const).map(([key, label, value, tip]) => (
          <div key={key}>
            <FieldHeader
              label={label}
              tip={tip}
              showDefault
              onUseDefault={() => updateDraftField(key, VENUE_STARTER_TEMPLATES[key])}
            />
            <Editor value={value} onChange={(nextValue) => updateDraftField(key, nextValue)} maxLength={MAX_VENUE_RICH_TEXT} />
            <input type="hidden" name={key} value={value} />
          </div>
        ))}
      </section>}

      {section === "general" && <section className="sb-card space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="sb-heading text-lg">Editorial board</h2><p className="mt-1 text-base text-slate-600 dark:text-slate-300">{board.length} member{board.length === 1 ? "" : "s"} · Add the structured public board used by the publish gate and ISSN metadata.</p></div><button type="button" className="sb-button-soft inline-flex items-center gap-2" onClick={() => { updateDraftField("board", [...board, { name: "", roleTitle: "", affiliation: "", orcid: "" }]); toast({ title: "Board member row added", description: "Complete the row and save venue settings." }); }}><Plus className="h-4 w-4" />Add member</button></div>
        <div className="space-y-4">
          {board.map((row, index) => (
            <div key={index} className="rounded-lg border border-[var(--card-border)] p-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <TextField id={`${venue.id}-board-name-${index}`} name="boardName" label="Name" value={row.name} onValueChange={(value) => updateBoard(index, "name", value)} maxLength={MAX_VENUE_BOARD_NAME} required tip="The board member's public name." />
                <TextField id={`${venue.id}-board-role-${index}`} name="boardRoleTitle" label="Role" value={row.roleTitle} onValueChange={(value) => updateBoard(index, "roleTitle", value)} maxLength={MAX_VENUE_BOARD_ROLE} required tip="For example, Associate Editor or Advisory Board Member." />
                <TextField id={`${venue.id}-board-affiliation-${index}`} name="boardAffiliation" label="Affiliation" value={row.affiliation} onValueChange={(value) => updateBoard(index, "affiliation", value)} maxLength={MAX_VENUE_BOARD_AFFILIATION} tip="Institution or department, if available." />
                <TextField id={`${venue.id}-board-orcid-${index}`} name="boardOrcid" label="ORCID" value={row.orcid} onValueChange={(value) => updateBoard(index, "orcid", value)} maxLength={MAX_VENUE_BOARD_ORCID} tip="Optional ORCID identifier." />
              </div>
              <button type="button" className="mt-3 inline-flex items-center gap-1 text-xs text-red-600 dark:text-red-300" onClick={() => { updateDraftField("board", board.filter((_, rowIndex) => rowIndex !== index)); toast({ title: "Board member removed from draft", description: "Save venue settings to apply this change." }); }}><Trash2 className="h-3.5 w-3.5" />Remove member</button>
            </div>
          ))}
          {board.length === 0 && <p className="rounded-lg border border-dashed border-[var(--card-border)] p-4 text-sm text-slate-500 dark:text-slate-400">No board members yet. Add at least one before publishing.</p>}
        </div>
      </section>}

      {state.message && <p role={state.success ? "status" : "alert"} className={state.success ? "rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-900/20 dark:text-emerald-200" : "rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-900/20 dark:text-red-300"}>{state.message}</p>}
      {!isRestored && <p className="text-xs text-slate-500 dark:text-slate-400">Restoring your draft…</p>}
      <SubmitButton label={section === "policies" ? "Save policies" : "Save general settings"} />
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
  const [activeTab, setActiveTab] = useState<"general" | "policies" | "publishing">("general");
  const selected = venues.find((venue) => venue.id === selectedId) ?? venues[0];

  if (!selected) return null;

  return (
    <div className="space-y-5">
      {venues.length > 1 && (
        <div className="sb-card">
          <label htmlFor="venue-settings-select" className="sb-label">
            Venue
          </label>
          <Select
            id="venue-settings-select"
            value={selected.id}
            onChange={(event) => setSelectedId(event.target.value)}
            className="sb-select"
          >
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.name} · {venue.type === "JOURNAL" ? "Journal" : "Conference"}
              </option>
            ))}
          </Select>
        </div>
      )}
      <nav aria-label="Venue settings sections" role="tablist" className="flex w-full flex-wrap gap-2 rounded-2xl border border-[var(--card-border)] bg-[var(--surface)] p-1.5 shadow-sm sm:inline-flex sm:w-auto">
        {([ ["general", "General"], ["policies", "Policies"], ["publishing", selected.type === "JOURNAL" ? "Issues" : "Editions"] ] as const).map(([id, label]) => (
          <button key={id} type="button" role="tab" onClick={() => setActiveTab(id)} aria-selected={activeTab === id} className={activeTab === id ? "rounded-xl bg-slate-950 px-4 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-950" : "rounded-xl px-4 py-2 text-sm font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-50"}>{label}</button>
        ))}
      </nav>
      {activeTab === "general" ? <VenueSettingsForm key={`${selected.id}-general`} venue={selected} section="general" /> : activeTab === "policies" ? <VenueSettingsForm key={`${selected.id}-policies`} venue={selected} section="policies" /> : <VenuePublishingRecords venue={selected} />}
    </div>
  );
}

function VenuePublishingRecords({ venue }: { venue: VenueSettingsValues }) {
  if (venue.type === "CONFERENCE") {
    const editions = venue.editions ?? [];
    const historical = editions.filter((edition) => /(legacy proceedings|imported archive)/i.test(edition.label));
    const current = editions.filter((edition) => !/(legacy proceedings|imported archive)/i.test(edition.label));
    return (
      <section className="sb-card mt-8 space-y-4">
        <div>
          <h2 className="sb-heading text-lg">Conference editions</h2>
          <p className="mt-1 text-base text-slate-600 dark:text-slate-300">Manage real event occurrences, their deadlines, proceedings metadata, and public program.</p>
        </div>
        <ul className="space-y-3 text-sm">
          {current.map((edition) => (
            <li key={edition.id} className="space-y-3 rounded-xl border border-[var(--card-border)] p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span><strong>{edition.label.replace(/\s+[—-]\s+(legacy proceedings|imported archive)$/i, "")}</strong><span className="ml-2 text-slate-500">/{edition.slug}</span>{/(legacy proceedings|imported archive)/i.test(edition.label) ? <span className="ml-2 rounded-full border border-amber-300/40 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-700 dark:text-amber-300">Historical archive</span> : null}</span>
                <span className="text-slate-500">{edition.volume ? `Vol. ${edition.volume}` : "No volume"}{edition.isPublished ? " · Public" : " · Draft"}</span>
              </div>
              <ConferenceEditionStatusForm editionId={edition.id} status={edition.status} isPublished={edition.isPublished} startsAt={edition.startsAt} endsAt={edition.endsAt} location={edition.location} timezone={edition.timezone} websiteUrl={edition.websiteUrl} proceedingsDoi={edition.proceedingsDoi} coverImageUrl={edition.coverImageUrl} cfpOpenAt={edition.cfpOpenAt} submissionDeadline={edition.submissionDeadline} notificationAt={edition.notificationAt} cameraReadyAt={edition.cameraReadyAt} />
              <details className="rounded-lg border border-[var(--card-border)] p-3">
                <summary className="cursor-pointer font-medium">Program ({edition.programItems?.length ?? 0})</summary>
                <ul className="mt-3 space-y-1 text-xs text-slate-500">{(edition.programItems ?? []).map((item) => <li key={item.id}><strong>{item.type.replace(/_/g, " ")}</strong> · {item.title}{item.speakers ? ` · ${item.speakers}` : ""}</li>)}</ul>
                <ConferenceProgramForm editionId={edition.id} />
              </details>
            </li>
          ))}
        </ul>
        {historical.length > 0 ? <details className="rounded-xl border border-amber-300/30 bg-amber-500/5 p-4 text-sm dark:border-amber-500/20">
          <summary className="cursor-pointer font-semibold text-amber-800 dark:text-amber-200">Historical records ({historical.length})</summary>
          <p className="mt-2 text-slate-600 dark:text-slate-400">These compatibility records preserve older conference submissions. They are not new editions and are not used when you create the next annual, biannual, or quarterly event.</p>
          <ul className="mt-3 space-y-2 text-xs text-slate-500">{historical.map((edition) => <li key={edition.id}>{edition.label.replace(/\s+[—-]\s+(legacy proceedings|imported archive)$/i, "")} · {edition.isPublished ? "Public archive" : "Unpublished archive"}</li>)}</ul>
        </details> : null}
        <details className="rounded-xl border border-dashed border-[var(--card-border)] p-4">
          <summary className="cursor-pointer font-semibold">Create a new conference edition</summary>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Use this only for a new real event. Imported archive records above are preserved for historical papers.</p>
          <ConferenceEditionForm venueId={venue.id} />
        </details>
      </section>
    );
  }

  return (
    <section className="sb-card mt-8 space-y-4">
      <div>
        <h2 className="sb-heading text-lg">Journal issues</h2>
        <p className="mt-1 text-base text-slate-600 dark:text-slate-300">Create and release issues centrally. Articles inherit their volume, issue number, and publication state from the issue.</p>
      </div>
      <ul className="space-y-3 text-sm">
        {(venue.journalIssues ?? []).map((issue) => <li key={issue.id} className="space-y-2 rounded-xl border border-[var(--card-border)] p-4"><div className="flex flex-wrap items-center justify-between gap-2"><span><strong>Volume {issue.volume}, Issue {issue.number}</strong>{issue.title ? <span className="ml-2 text-slate-500">{issue.title}</span> : null}</span><span className="text-slate-500">{issue.isPublished ? "Public" : "Draft"}</span></div><JournalIssueStatusForm issueId={issue.id} status={issue.status} isPublished={issue.isPublished} title={issue.title} description={issue.description} publicationDate={issue.publicationDate} coverImageUrl={issue.coverImageUrl} doi={issue.doi} /></li>)}
      </ul>
      <details className="rounded-xl border border-dashed border-[var(--card-border)] p-4">
        <summary className="cursor-pointer font-semibold">Create a new journal issue</summary>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Define the issue metadata first, then open it for editors to assign accepted articles.</p>
        <JournalIssueForm venueId={venue.id} />
      </details>
    </section>
  );
}
