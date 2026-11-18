"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { createJournalIssueAction, updateJournalIssueAction, type VenueActionResult } from "@/app/actions/publishing";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { Editor } from "@/components/ui/Editor";
import { ContentImageUploadField } from "@/components/upload/ContentImageUploadField";

const EMPTY: VenueActionResult = { success: false, message: "" };
const STATUSES = ["DRAFT", "OPEN", "LOCKED", "PUBLISHED", "ARCHIVED"] as const;

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return <button className="sb-button-primary" disabled={pending} type="submit">{pending ? "Saving…" : children}</button>;
}

export function JournalIssueForm({ venueId }: { venueId: string }) {
  const [state, action] = useActionState(createJournalIssueAction, EMPTY);
  const [description, setDescription] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  return <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
    <input type="hidden" name="venueId" value={venueId} />
    <div><label className="sb-label inline-flex items-center gap-1.5" htmlFor={`${venueId}-issue-volume`}>Volume <InfoTooltip message="Annual journal volume. It normally increments once per publication year." /></label><input required id={`${venueId}-issue-volume`} name="volume" type="number" min="1" className="sb-input" placeholder="1" /></div>
    <div><label className="sb-label inline-flex items-center gap-1.5" htmlFor={`${venueId}-issue-number`}>Issue number <InfoTooltip message="The issue number within the volume, for example 1 through 4 for a quarterly journal." /></label><input required id={`${venueId}-issue-number`} name="number" type="number" min="1" className="sb-input" placeholder="1" /></div>
    <div className="sm:col-span-2"><label className="sb-label inline-flex items-center gap-1.5" htmlFor={`${venueId}-issue-title`}>Issue title <InfoTooltip message="Optional theme or special issue title shown in the archive." /></label><input id={`${venueId}-issue-title`} name="title" maxLength={160} className="sb-input" placeholder="Special issue on…" /><p className="mt-1 text-xs text-slate-500">Maximum 160 characters.</p></div>
    <div className="sm:col-span-2"><label className="sb-label inline-flex items-center gap-1.5" htmlFor={`${venueId}-issue-description`}>Issue description <InfoTooltip message="A short editorial description explaining the issue theme and scope." /></label><Editor value={description} onChange={setDescription} maxLength={4000} /><input type="hidden" name="description" value={description} /></div>
    <div><label className="sb-label inline-flex items-center gap-1.5" htmlFor={`${venueId}-issue-publication-date`}>Publication date <InfoTooltip message="The date the issue is formally released to readers." /></label><input id={`${venueId}-issue-publication-date`} name="publicationDate" type="date" className="sb-input" /></div>
    <div><label className="sb-label inline-flex items-center gap-1.5" htmlFor={`${venueId}-issue-doi`}>Issue DOI <InfoTooltip message="The DOI for the complete issue, if assigned by a DOI agency." /></label><input id={`${venueId}-issue-doi`} name="doi" className="sb-input" placeholder="10.xxxx/…" /></div>
    <div className="sm:col-span-2"><label className="sb-label inline-flex items-center gap-1.5">Cover image <InfoTooltip message="Optional cover image for the public issue archive." /></label><ContentImageUploadField kind="journal-cover" value={coverImageUrl} onChange={setCoverImageUrl} buttonLabel="Upload cover image" /><input type="hidden" name="coverImageUrl" value={coverImageUrl} /></div>
    <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><Submit>Create issue</Submit>{state.message ? <p role={state.success ? "status" : "alert"} className="text-sm text-slate-600 dark:text-slate-300">{state.message}</p> : null}</div>
  </form>;
}

export function JournalIssueStatusForm({ issueId, status, isPublished, title = null, description = null, publicationDate = null, coverImageUrl = null, doi = null }: { issueId: string; status: string; isPublished: boolean; title?: string | null; description?: string | null; publicationDate?: Date | string | null; coverImageUrl?: string | null; doi?: string | null }) {
  const [state, action] = useActionState(updateJournalIssueAction, EMPTY);
  const [descriptionValue, setDescriptionValue] = useState(description ?? "");
  const [coverValue, setCoverValue] = useState(coverImageUrl ?? "");
  const date = publicationDate ? (publicationDate instanceof Date ? publicationDate.toISOString() : publicationDate).slice(0, 10) : "";
  return <form action={action} className="space-y-3"><input type="hidden" name="issueId" value={issueId} /><div className="flex flex-wrap items-center gap-2"><select name="status" defaultValue={status} className="sb-input w-auto py-1.5 text-sm">{STATUSES.map((value) => <option key={value} value={value}>{value}</option>)}</select><label className="inline-flex items-center gap-1.5 text-sm"><input type="checkbox" name="isPublished" value="true" defaultChecked={isPublished} /> Public</label></div><div className="grid gap-3 sm:grid-cols-2"><input aria-label="Issue title" name="title" defaultValue={title ?? ""} maxLength={160} placeholder="Issue title" className="sb-input text-sm" /><input aria-label="Publication date" name="publicationDate" type="date" defaultValue={date} className="sb-input text-sm" /><input aria-label="Issue DOI" name="doi" defaultValue={doi ?? ""} placeholder="Issue DOI" className="sb-input text-sm" /><div className="sm:col-span-2"><ContentImageUploadField kind="journal-cover" value={coverValue} onChange={setCoverValue} buttonLabel="Upload cover image" /><input type="hidden" name="coverImageUrl" value={coverValue} /></div><div className="sm:col-span-2"><Editor value={descriptionValue} onChange={setDescriptionValue} maxLength={4000} /><input type="hidden" name="description" value={descriptionValue} /></div></div><div className="flex flex-wrap items-center gap-2"><Submit>Save</Submit>{state.message ? <span className="text-xs text-slate-500">{state.message}</span> : null}</div></form>;
}
