"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";

import { createConferenceEditionAction, type VenueActionResult } from "@/app/actions/publishing";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { ContentImageUploadField } from "@/components/upload/ContentImageUploadField";

const EMPTY: VenueActionResult = { success: false, message: "" };

function Submit() {
  const { pending } = useFormStatus();
  return <button className="sb-button-primary" disabled={pending} type="submit">{pending ? "Creating…" : "Create edition"}</button>;
}

export function ConferenceEditionForm({ venueId }: { venueId: string }) {
  const [state, action] = useActionState(createConferenceEditionAction, EMPTY);
  const [coverImageUrl, setCoverImageUrl] = useState("");
  return (
    <form action={action} className="mt-4 grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="venueId" value={venueId} />
      <div className="sm:col-span-2 border-b border-[var(--card-border)] pb-1"><h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Edition identity</h3><p className="mt-1 text-xs text-slate-500">Define the occurrence and its permanent citation key.</p></div>
      <div><label className="sb-label inline-flex items-center gap-1.5" htmlFor={`${venueId}-edition-year`}>Year <InfoTooltip message="The calendar year of this actual conference occurrence." /></label><input required id={`${venueId}-edition-year`} name="year" type="number" min="2000" max="2200" className="sb-input" placeholder="2027" /></div>
      <div><label className="sb-label inline-flex items-center gap-1.5" htmlFor={`${venueId}-edition-term`}>Term <InfoTooltip message="Leave blank for annual or biennial editions; use H1/H2 or Q1-Q4 for multiple events in a year." /></label><select id={`${venueId}-edition-term`} name="term" className="sb-input"><option value="">Annual / biennial</option><option value="h1">H1</option><option value="h2">H2</option><option value="q1">Q1</option><option value="q2">Q2</option><option value="q3">Q3</option><option value="q4">Q4</option></select></div>
      <div><label className="sb-label inline-flex items-center gap-1.5" htmlFor={`${venueId}-edition-slug`}>Edition key <InfoTooltip message="Stable URL key, for example 2027, 2027-h1, or 2027-q3." /></label><input required id={`${venueId}-edition-slug`} name="slug" className="sb-input" placeholder="2027-q1" /></div>
      <div><label className="sb-label inline-flex items-center gap-1.5" htmlFor={`${venueId}-edition-label`}>Display label <InfoTooltip message="The public title shown on the edition page and in citations." /></label><input required id={`${venueId}-edition-label`} name="label" maxLength={120} className="sb-input" placeholder="ScholarBase Conference 2027 — Q1" /></div>
      <div className="sm:col-span-2 border-b border-[var(--card-border)] pb-1 pt-2"><h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Proceedings</h3><p className="mt-1 text-xs text-slate-500">Add the volume identifiers used by published conference papers.</p></div>
      <div><label className="sb-label inline-flex items-center gap-1.5" htmlFor={`${venueId}-edition-volume`}>Proceedings volume <InfoTooltip message="The one proceedings volume owned by this edition. It is copied to papers when they are published." /></label><input id={`${venueId}-edition-volume`} name="volume" type="number" min="1" className="sb-input" placeholder="1" /></div>
      <div><label className="sb-label inline-flex items-center gap-1.5" htmlFor={`${venueId}-edition-isbn`}>ISBN-13 <InfoTooltip message="The ISBN assigned to this collected proceedings volume." /></label><input id={`${venueId}-edition-isbn`} name="isbn" maxLength={17} className="sb-input" placeholder="978-…" /></div>
      <div className="sm:col-span-2 border-b border-[var(--card-border)] pb-1 pt-2"><h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Event logistics</h3><p className="mt-1 text-xs text-slate-500">Help attendees and authors find the event and its official site.</p></div>
      <div><label className="sb-label" htmlFor={`${venueId}-edition-start`}>Event starts</label><input id={`${venueId}-edition-start`} name="startsAt" type="date" className="sb-input" /></div>
      <div><label className="sb-label" htmlFor={`${venueId}-edition-end`}>Event ends</label><input id={`${venueId}-edition-end`} name="endsAt" type="date" className="sb-input" /></div>
      <div><label className="sb-label" htmlFor={`${venueId}-edition-location`}>Location</label><input id={`${venueId}-edition-location`} name="location" maxLength={160} className="sb-input" placeholder="Online / New Delhi" /></div>
      <div><label className="sb-label" htmlFor={`${venueId}-edition-timezone`}>Timezone</label><input id={`${venueId}-edition-timezone`} name="timezone" maxLength={64} className="sb-input" placeholder="Asia/Kolkata" /></div>
      <div><label className="sb-label" htmlFor={`${venueId}-edition-website`}>Event website</label><input id={`${venueId}-edition-website`} name="websiteUrl" type="url" className="sb-input" placeholder="https://…" /></div>
      <div><label className="sb-label" htmlFor={`${venueId}-edition-doi`}>Proceedings DOI</label><input id={`${venueId}-edition-doi`} name="proceedingsDoi" className="sb-input" placeholder="10.xxxx/…" /></div>
      <div className="sm:col-span-2"><label className="sb-label inline-flex items-center gap-1.5">Edition cover image <InfoTooltip message="Optional cover image for the public conference edition page." /></label><ContentImageUploadField kind="conference-cover" value={coverImageUrl} onChange={setCoverImageUrl} buttonLabel="Upload edition cover" /><input type="hidden" name="coverImageUrl" value={coverImageUrl} /></div>
      <div className="sm:col-span-2 border-b border-[var(--card-border)] pb-1 pt-2"><h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">Editorial schedule</h3><p className="mt-1 text-xs text-slate-500">Keep CFP, notification, and camera-ready milestones visible to the editorial team.</p></div>
      <div><label className="sb-label" htmlFor={`${venueId}-edition-cfp`}>CFP opens</label><input id={`${venueId}-edition-cfp`} name="cfpOpenAt" type="date" className="sb-input" /></div>
      <div><label className="sb-label" htmlFor={`${venueId}-edition-deadline`}>Submission deadline</label><input id={`${venueId}-edition-deadline`} name="submissionDeadline" type="date" className="sb-input" /></div>
      <div><label className="sb-label" htmlFor={`${venueId}-edition-notification`}>Notification date</label><input id={`${venueId}-edition-notification`} name="notificationAt" type="date" className="sb-input" /></div>
      <div><label className="sb-label" htmlFor={`${venueId}-edition-camera-ready`}>Camera-ready deadline</label><input id={`${venueId}-edition-camera-ready`} name="cameraReadyAt" type="date" className="sb-input" /></div>
      <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><Submit />{state.message ? <p role={state.success ? "status" : "alert"} className="text-sm text-slate-600 dark:text-slate-300">{state.message}</p> : null}</div>
    </form>
  );
}
