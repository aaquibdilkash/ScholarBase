"use client";

import { usePathname } from "next/navigation";
import { useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { Share } from "lucide-react";

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
      className="inline-flex h-8 min-w-8 items-center justify-center gap-2 rounded-lg px-1 text-sm font-medium transition hover:bg-slate-100 hover:text-blue-600 dark:hover:bg-slate-800"
      aria-label={label}
      title={label}
    >
      <Share className="w-5 h-5" />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
