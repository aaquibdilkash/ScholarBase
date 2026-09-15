"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { useToast } from "@/components/ui/Toast";

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
  const { toast } = useToast();
  // BUGFIX: The spinner (Saving...) must reflect ONLY an actual in-flight
  // form submission (useFormStatus().pending). A plain disabled prop, such as
  // disabling when a rich-text editor exceeds its character limit, must merely
  // disable the button -- it must never show the loading spinner.
  const isValidationDisabled = Boolean(disabled) && !pending;

  return (
    <button
      type={isValidationDisabled ? "button" : "submit"}
      disabled={pending}
      aria-disabled={pending || isValidationDisabled}
      onClick={
        isValidationDisabled
          ? () =>
              toast(
                "Please fix the highlighted validation issue before saving.",
                "error",
              )
          : undefined
      }
      className={className}
    >
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
