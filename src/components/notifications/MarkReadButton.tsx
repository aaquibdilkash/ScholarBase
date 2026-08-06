"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  markNotificationRead,
  markAllNotificationsRead,
} from "@/app/actions/notifications";
import { useToast } from "@/components/ui/Toast";
import { Loader2 } from "lucide-react";

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
          <Loader2 className="animate-spin h-4 w-4" />
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
          <Loader2 className="animate-spin h-4 w-4" />
          Marking...
        </>
      ) : (
        "Mark all read"
      )}
    </button>
  );
}
