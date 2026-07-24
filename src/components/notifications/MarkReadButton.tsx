"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/actions/notifications";
import { useToast } from "@/components/ui/Toast";

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            await markNotificationRead(notificationId);
            toast("Marked as read", "success");
          } catch {
            toast("Failed to mark as read. Please try again.", "error");
          }
        });
      }}
      className="sb-button-soft whitespace-nowrap px-4 py-2 disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-2"
    >
      {isPending ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Marking...
        </>
      ) : (
        "Mark read"
      )}
    </button>
  );
}

export function MarkAllReadButton() {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => {
        startTransition(async () => {
          try {
            await markAllNotificationsRead();
            toast("All notifications marked as read", "success");
          } catch {
            toast("Failed to mark all as read. Please try again.", "error");
          }
        });
      }}
      className="sb-button-soft whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-2"
    >
      {isPending ? (
        <>
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
          Marking...
        </>
      ) : (
        "Mark all read"
      )}
    </button>
  );
}
