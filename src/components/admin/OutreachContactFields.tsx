"use client";

import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  MAX_OUTREACH_EMAIL,
  MAX_OUTREACH_INSTITUTION,
  MAX_OUTREACH_NAME,
  MAX_OUTREACH_NOTES,
  MAX_OUTREACH_ROLE,
  MAX_OUTREACH_SOURCE,
} from "@/lib/constants";
import {
  OUTREACH_EMAIL_TIP,
  OUTREACH_INSTITUTION_TIP,
  OUTREACH_NAME_TIP,
  OUTREACH_NOTES_TIP,
  OUTREACH_ROLE_TIP,
  OUTREACH_SOURCE_TIP,
} from "@/constants/tooltips";

/** Shared field set for the add and edit outreach modals. */
export type OutreachContactFieldValues = {
  name: string;
  email: string;
  institution: string;
  role: string;
  source: string;
  notes: string;
};

export const EMPTY_OUTREACH_FIELDS: OutreachContactFieldValues = {
  name: "",
  email: "",
  institution: "",
  role: "",
  source: "",
  notes: "",
};

export const outreachInputClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

const labelClassName =
  "block text-xs font-semibold text-slate-700 dark:text-slate-300";

function FieldLabel({ children, tip }: { children: string; tip: string }) {
  return (
    <label className={`${labelClassName} inline-flex items-center gap-1.5`}>
      {children}
      <InfoTooltip message={tip} />
    </label>
  );
}

function CharacterCount({ value, max }: { value: string; max: number }) {
  return (
    <div
      className="mt-1 text-xs text-slate-500 dark:text-slate-400"
      aria-live="polite"
    >
      {value.length}/{max} characters
    </div>
  );
}

export function OutreachContactFields({
  values,
  onChange,
  disabled = false,
  autoFocusName = false,
}: {
  values: OutreachContactFieldValues;
  onChange: (field: keyof OutreachContactFieldValues, value: string) => void;
  disabled?: boolean;
  autoFocusName?: boolean;
}) {
  return (
    <>
      <div className="space-y-2">
        <FieldLabel tip={OUTREACH_NAME_TIP}>Name</FieldLabel>
        <input
          type="text"
          value={values.name}
          onChange={(e) => onChange("name", e.target.value)}
          placeholder="Jane Scholar"
          maxLength={MAX_OUTREACH_NAME}
          className={outreachInputClassName}
          disabled={disabled}
          required
          autoFocus={autoFocusName}
        />
        <CharacterCount value={values.name} max={MAX_OUTREACH_NAME} />
      </div>

      <div className="space-y-2">
        <FieldLabel tip={OUTREACH_EMAIL_TIP}>Email</FieldLabel>
        <input
          type="email"
          value={values.email}
          onChange={(e) => onChange("email", e.target.value)}
          placeholder="jane@university.edu"
          maxLength={MAX_OUTREACH_EMAIL}
          className={outreachInputClassName}
          disabled={disabled}
          required
        />
        <CharacterCount value={values.email} max={MAX_OUTREACH_EMAIL} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <FieldLabel tip={OUTREACH_INSTITUTION_TIP}>Institution</FieldLabel>
          <input
            type="text"
            value={values.institution}
            onChange={(e) => onChange("institution", e.target.value)}
            placeholder="University name"
            maxLength={MAX_OUTREACH_INSTITUTION}
            className={outreachInputClassName}
            disabled={disabled}
          />
          <CharacterCount
            value={values.institution}
            max={MAX_OUTREACH_INSTITUTION}
          />
        </div>
        <div className="space-y-2">
          <FieldLabel tip={OUTREACH_ROLE_TIP}>Role</FieldLabel>
          <input
            type="text"
            value={values.role}
            onChange={(e) => onChange("role", e.target.value)}
            placeholder="Professor / PhD candidate"
            maxLength={MAX_OUTREACH_ROLE}
            className={outreachInputClassName}
            disabled={disabled}
          />
          <CharacterCount value={values.role} max={MAX_OUTREACH_ROLE} />
        </div>
      </div>

      <div className="space-y-2">
        <FieldLabel tip={OUTREACH_SOURCE_TIP}>Source</FieldLabel>
        <input
          type="text"
          value={values.source}
          onChange={(e) => onChange("source", e.target.value)}
          placeholder="e.g. conference, referral, LinkedIn"
          maxLength={MAX_OUTREACH_SOURCE}
          className={outreachInputClassName}
          disabled={disabled}
        />
        <CharacterCount value={values.source} max={MAX_OUTREACH_SOURCE} />
      </div>

      <div className="space-y-2">
        <FieldLabel tip={OUTREACH_NOTES_TIP}>Notes</FieldLabel>
        <textarea
          value={values.notes}
          onChange={(e) => onChange("notes", e.target.value)}
          placeholder="How you met them, what to discuss, …"
          rows={3}
          maxLength={MAX_OUTREACH_NOTES}
          className={`${outreachInputClassName} resize-y leading-6`}
          disabled={disabled}
        />
        <CharacterCount value={values.notes} max={MAX_OUTREACH_NOTES} />
      </div>
    </>
  );
}
