"use client";

import { usePathname } from "next/navigation";
import { useCallback } from "react";
import { useToast } from "@/components/ui/Toast";

export function ShareButton({
  href,
  label = "Share",
}: {
  href?: string;
  label?: string;
}) {
  const pathname = usePathname();
  const { toast } = useToast();

  const onShare = useCallback(async () => {
    const shareUrl = href || (typeof window !== "undefined" ? `${window.location.origin}${pathname}` : "");

    try {
      if (typeof navigator !== "undefined" && "share" in navigator) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (navigator as any).share({ url: shareUrl });
        return;
      }

      if (shareUrl) {
        const nav = navigator as Navigator & {
          clipboard?: { writeText?: (text: string) => Promise<void> };
        };

        if (typeof navigator !== "undefined" && nav.clipboard?.writeText) {
          await nav.clipboard.writeText(shareUrl);
          toast("Link copied!");
        }
      }
    } catch {
      // ignore (user canceled or clipboard denied)
    }
  }, [href, pathname, toast]);

  return (
    <button
      type="button"
      onClick={onShare}
      className="text-sm font-medium hover:text-blue-600 transition flex items-center gap-2"
      aria-label={label}
      title={label}
    >
      <svg
        className="w-5 h-5"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
        <path d="M16 6l-4-4-4 4" />
        <path d="M12 2v14" />
      </svg>
      <span className="hidden md:inline">{label}</span>
    </button>
  );
}
