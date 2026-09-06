"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";

export function SubmitBtn({
  children,
  className = "sb-button-accent",
  loadingText,
  disabled,
}: {
  children: ReactNode;
  className?: string;
  loadingText?: string;
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  // BUGFIX: The spinner (Saving...) must reflect ONLY an actual in-flight
  // form submission (useFormStatus().pending). A plain disabled prop, such as
  // disabling when a rich-text editor exceeds its character limit, must merely
  // disable the button -- it must never show the loading spinner.
  const isDisabled = pending || disabled;

  return (
    <button type="submit" disabled={isDisabled} className={className}>
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="animate-spin h-4 w-4" />
          {loadingText || "Saving..."}
        </span>
      ) : (
        children
      )}
    </button>
  );
}
