"use client";

import { ChevronRight } from "lucide-react";
import { useState } from "react";

export function RejectionReason({ reason }: { reason: string }) {
  const [showReason, setShowReason] = useState(false);

  return (
    <div className="mb-3">
      <button
        onClick={() => setShowReason(!showReason)}
        className="flex items-center gap-1 text-xs font-semibold text-red-600 hover:text-red-700 transition"
      >
        <ChevronRight
          className={`h-3 w-3 transition-transform ${
            showReason ? "rotate-90" : ""
          }`}
        />
        Why was this rejected?
      </button>
      {showReason && (
        <div className="mt-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-700">
          {reason}
        </div>
      )}
    </div>
  );
}
