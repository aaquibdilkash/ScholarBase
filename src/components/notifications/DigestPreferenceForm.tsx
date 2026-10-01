"use client";

import { useState, useTransition } from "react";
import { updateDigestPreference } from "@/app/actions/notification-preferences";
import { useToast } from "@/components/ui/Toast";

/**
 * Digest cadence selector.
 *
 * This is the opt-IN surface. Without it, flipping the schema default to
 * opt-in would strand users on `NEVER`: no digest arrives, so no link arrives,
 * so the feature can never be discovered. Every other preference on the
 * settings page is opt-out because it is ON by default; this one is the inverse
 * and needs to be chosen deliberately.
 *
 * Radios rather than a select, so all three options and their consequences are
 * visible at once — "Off" means "you will stop getting digests", which should
 * never be a hidden dropdown value.
 */
const OPTIONS = [
  {
    value: "DAILY",
    label: "Daily",
    hint: "A summary of unread activity, every morning.",
  },
  {
    value: "WEEKLY",
    label: "Weekly",
    hint: "A summary of the week's unread activity, every Monday.",
  },
  {
    value: "NEVER",
    label: "Off",
    hint: "No digest emails. In-app notifications are unaffected.",
  },
] as const;

type Preference = (typeof OPTIONS)[number]["value"];

export function DigestPreferenceForm({
  current,
}: {
  current: Preference;
}) {
  const [selected, setSelected] = useState<Preference>(current);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  // Only treat this as dirty against the server-confirmed value, so a failed
  // save leaves the radio where the user put it and they can retry.
  const isDirty = selected !== current;

  function handleChange(value: Preference) {
    setSelected(value);
    setError(null);

    startTransition(async () => {
      try {
        const result = await updateDigestPreference(value);
        if (result.success) {
          // Adopt what the database actually stored, not what we asked for.
          setSelected(result.data.digestPreference as Preference);
          toast("Digest preference updated", "success");
        } else {
          setError(result.error);
          setSelected(current);
        }
      } catch {
        setError("We could not save your digest preference. Please try again.");
        setSelected(current);
      }
    });
  }

  return (
    <fieldset className="mt-5 space-y-3 border-t border-slate-200/70 pt-5 dark:border-slate-800">
      <legend className="sb-label">Email digest</legend>

      <div className="space-y-2" role="radiogroup" aria-label="Email digest frequency">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200/70 p-3 text-sm transition hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-900/40"
          >
            <input
              type="radio"
              name="digestPreference"
              value={option.value}
              checked={selected === option.value}
              onChange={() => handleChange(option.value)}
              disabled={isPending}
              className="mt-0.5"
            />
            <span className="min-w-0">
              <span className="font-medium text-slate-900 dark:text-slate-50">
                {option.label}
              </span>
              <span className="mt-0.5 block text-slate-500 dark:text-slate-400">
                {option.hint}
              </span>
            </span>
          </label>
        ))}
      </div>

      {isPending ? (
        <p className="text-xs text-slate-400" role="status">
          Saving…
        </p>
      ) : null}
      {error ? (
        <p className="text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {!isDirty && !error ? (
        <p className="text-xs text-slate-400">Saved. Each change applies immediately.</p>
      ) : null}
    </fieldset>
  );
}
