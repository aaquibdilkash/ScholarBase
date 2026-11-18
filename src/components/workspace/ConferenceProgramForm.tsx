"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";

import { createConferenceProgramItemAction, type VenueActionResult } from "@/app/actions/publishing";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { TextField } from "@/components/ui/TextField";

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
    <TextField id={`${editionId}-program-title`} name="title" label="Title" tip="The public schedule title, up to 200 characters." maxLength={200} className="sb-input" required />
    <TextField id={`${editionId}-program-speakers`} name="speakers" label="Speakers" tip="Names and affiliations of the speakers or presenters." maxLength={500} className="sb-input" placeholder="Names, affiliations" />
    <TextField id={`${editionId}-program-track`} name="track" label="Track" tip="The program track or subject area for this item." maxLength={120} className="sb-input" />
    <TextField id={`${editionId}-program-room`} name="room" label="Room / stream" tip="The physical room, virtual room, or streaming channel." maxLength={120} className="sb-input" />
    <div><label className="sb-label inline-flex items-center gap-1.5" htmlFor={`${editionId}-program-start`}>Starts <InfoTooltip message="The scheduled start time for this program item." /></label><input id={`${editionId}-program-start`} name="startsAt" type="datetime-local" className="sb-input" /></div>
    <div><label className="sb-label inline-flex items-center gap-1.5" htmlFor={`${editionId}-program-end`}>Ends <InfoTooltip message="The scheduled end time for this program item." /></label><input id={`${editionId}-program-end`} name="endsAt" type="datetime-local" className="sb-input" /></div>
    <TextField id={`${editionId}-program-link`} name="externalUrl" label="External link" tip="A public page with more information about this program item." maxLength={512} type="url" className="sb-input" placeholder="https://…" />
    <div className="sm:col-span-2"><TextField as="textarea" id={`${editionId}-program-description`} name="description" label="Description" tip="A concise description of the talk, paper, workshop, or other schedule item." maxLength={2000} className="sb-textarea min-h-20" /></div>
    <div className="sm:col-span-2 flex flex-wrap items-center gap-3"><Submit />{state.message ? <p role={state.success ? "status" : "alert"} className="text-sm text-slate-600 dark:text-slate-300">{state.message}</p> : null}</div>
  </form>;
}
