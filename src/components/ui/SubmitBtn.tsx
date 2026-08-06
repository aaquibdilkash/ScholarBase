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
