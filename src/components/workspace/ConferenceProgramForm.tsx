"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createConferenceProgramItemAction, type VenueActionResult } from "@/app/actions/publishing";
import { InfoTooltip } from "@/components/ui/InfoTooltip";

const EMPTY: VenueActionResult = { success: false, message: "" };

function Submit() {
  const { pending } = useFormStatus();
  return <button className="sb-button-primary px-3 py-2 text-sm" disabled={pending} type="submit">{pending ? "Adding…" : "Add program item"}</button>;
}

export function ConferenceProgramForm({ editionId }: { editionId: string }) {
  const [state, action] = useActionState(createConferenceProgramItemAction, EMPTY);
  return <form action={action} className="mt-4 grid gap-3 sm:grid-cols-2">
    <input type="hidden" name="editionId" value={editionId} />
    <div><label className="sb-label inline-flex items-center gap-1.5" htmlFor={`${editionId}-program-type`}>Type <InfoTooltip message="Use Paper or Poster for accepted submissions; use Keynote, Workshop, or Break for event sessions." /></label><select id={`${editionId}-program-type`} name="type" defaultValue="PAPER" className="sb-input"><option value="KEYNOTE">Keynote</option><option value="INVITED_TALK">Invited talk</option><option value="PAPER">Paper</option><option value="POSTER">Poster</option><option value="WORKSHOP">Workshop</option><option value="BREAK">Break</option><option value="OTHER">Other</option></select></div>
    <div><label className="sb-label inline-flex items-center gap-1.5" htmlFor={`${editionId}-program-title`}>Title <InfoTooltip message="The public schedule title, up to 200 characters." /></label><input required id={`${editionId}-program-title`} name="title" maxLength={200} className="sb-input" /></div>
    <div><label className="sb-label" htmlFor={`${editionId}-program-speakers`}>Speakers</label><input id={`${editionId}-program-speakers`} name="speakers" maxLength={500} className="sb-input" placeholder="Names, affiliations" /></div>
    <div><label className="sb-label" htmlFor={`${editionId}-program-track`}>Track</label><input id={`${editionId}-program-track`} name="track" maxLength={120} className="sb-input" /></div>
    <div><label className="sb-label" htmlFor={`${editionId}-program-room`}>Room / stream</label><input id={`${editionId}-program-room`} name="room" maxLength={120} className="sb-input" /></div>
    <div><label className="sb-label" htmlFor={`${editionId}-program-start`}>Starts</label><input id={`${editionId}-program-start`} name="startsAt" type="datetime-local" className="sb-input" /></div>
    <div><label className="sb-label" htmlFor={`${editionId}-program-end`}>Ends</label><input id={`${editionId}-program-end`} name="endsAt" type="datetime-local" className="sb-input" /></div>
    <div><label className="sb-label" htmlFor={`${editionId}-program-link`}>External link</label><input id={`${editionId}-program-link`} name="externalUrl" type="url" className="sb-input" placeholder="https://…" /></div>
    <div className="sm:col-span-2"><label className="sb-label" htmlFor={`${editionId}-program-description`}>Description</label><textarea id={`${editionId}-program-description`} name="description" maxLength={2000} className="sb-textarea min-h-20" /></div>
    <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><Submit />{state.message ? <p role={state.success ? "status" : "alert"} className="text-sm text-slate-600 dark:text-slate-300">{state.message}</p> : null}</div>
  </form>;
}
