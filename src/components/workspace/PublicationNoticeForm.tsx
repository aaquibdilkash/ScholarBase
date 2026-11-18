"use client";

import { useActionState, useState } from "react";

import { createPublicationNoticeAction, type PublicationIntegrityResult } from "@/app/actions/publication-integrity";
import { Editor } from "@/components/ui/Editor";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import { ActionResultMessage } from "@/components/workspace/ActionResultMessage";
import { SubmitBtn } from "@/components/ui/SubmitBtn";
import { TextField } from "@/components/ui/TextField";
import { PUBLICATION_NOTICE_TYPES } from "@/lib/publishing/integrity";

const EMPTY: PublicationIntegrityResult = { success: false, message: "" };

const TYPE_LABELS = {
  CORRECTION: "Correction",
  RETRACTION: "Retraction",
  EXPRESSION_OF_CONCERN: "Expression of concern",
} as const;

export function PublicationNoticeForm({ manuscriptId }: { manuscriptId: string }) {
  const [state, action] = useActionState(createPublicationNoticeAction, EMPTY);
  const [body, setBody] = useState("");

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="manuscriptId" value={manuscriptId} />
      <label className="block">
        <span className="sb-label inline-flex items-center gap-1.5">Notice type <InfoTooltip message="This record is immutable. If the situation changes, add a later notice rather than editing or deleting this one." /></span>
        <select name="type" defaultValue="CORRECTION" className="sb-input">
          {PUBLICATION_NOTICE_TYPES.map((value) => <option key={value} value={value}>{TYPE_LABELS[value]}</option>)}
        </select>
      </label>
      <TextField id="publication-notice-title" name="title" label="Notice title" tip="A concise public title describing the correction, retraction, or expression of concern." maxLength={160} className="sb-input" placeholder="Correction to the published record" required />
      <div>
        <label className="sb-label">Reason and editorial explanation <InfoTooltip message="Explain what changed, why the notice is necessary, and what readers should rely on. Do not include confidential reviewer information." /></label>
        <Editor value={body} onChange={setBody} maxLength={12000} />
        <input type="hidden" name="body" value={body} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <SubmitBtn className="sb-button-primary" loadingText="Recording…">Record notice</SubmitBtn>
        <ActionResultMessage state={state} />
      </div>
    </form>
  );
}
