"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import {
  closeSurvey,
  reopenSurvey,
  toggleShareData,
} from "@/app/actions/surveys";
import { useToast } from "@/components/ui/Toast";

type SurveyStatus = "OPEN" | "CLOSED";

interface SurveyOwnerControlsProps {
  surveyId: string;
  initialStatus: SurveyStatus;
  initialShareData: boolean;
}

export function SurveyOwnerControls({
  surveyId,
  initialStatus,
  initialShareData,
}: SurveyOwnerControlsProps) {
  const [isPending, startTransition] = useTransition();
  const { toast } = useToast();

  const [state, setState] = useState<{
    status: SurveyStatus;
    shareData: boolean;
  }>({
    status: initialStatus,
    shareData: initialShareData,
  });

  const [pendingAction, setPendingAction] = useState<
    "close" | "reopen" | "share" | null
  >(null);

  const handleClose = () => {
    setPendingAction("close");
    startTransition(async () => {
      const result = await closeSurvey(surveyId);
      if (result.success && result.data) {
        setState({
          status: (result.data.status as SurveyStatus) ?? "CLOSED",
          shareData: Boolean(result.data.shareData),
        });
        toast({ title: "Survey closed", description: "Responses are no longer being accepted." });
      } else {
        toast({ title: "Error", description: "Failed to close survey.", variant: "destructive" });
      }
      setPendingAction(null);
    });
  };

  const handleReopen = () => {
    setPendingAction("reopen");
    startTransition(async () => {
      const result = await reopenSurvey(surveyId);
      if (result.success && result.data) {
        setState({
          status: (result.data.status as SurveyStatus) ?? "OPEN",
          shareData: Boolean(result.data.shareData),
        });
        toast({ title: "Survey reopened", description: "Responses are being accepted again." });
      } else {
        toast({ title: "Error", description: "Failed to reopen survey.", variant: "destructive" });
      }
      setPendingAction(null);
    });
  };

  const handleToggleShare = () => {
    setPendingAction("share");
    startTransition(async () => {
      const result = await toggleShareData(surveyId);
      if (result.success && result.data) {
        setState({
          status: (result.data.status as SurveyStatus) ?? state.status,
          shareData: Boolean(result.data.shareData),
        });
        toast({
          title: "Data sharing enabled",
          description: "Respondents can now view aggregate results.",
        });
      } else {
        toast({
          title: "Error",
          description: "Failed to enable data sharing.",
          variant: "destructive",
        });
      }
      setPendingAction(null);
    });
  };

  const isOpen = state.status === "OPEN";
  const showResults = state.shareData || !isOpen;
  const busy = (action: "close" | "reopen" | "share") =>
    isPending && pendingAction === action;

  return (
    <div className="flex gap-2 sm:gap-3 mb-6 sm:mb-8 flex-wrap">
      {isOpen ? (
        <button
          type="button"
          onClick={handleClose}
          disabled={busy("close") || isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 transition disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy("close") && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy("close") ? "Closing…" : "Close Survey"}
        </button>
      ) : (
        <button
          type="button"
          onClick={handleReopen}
          disabled={busy("reopen") || isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2 text-sm font-semibold text-green-700 hover:bg-green-100 transition disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy("reopen") && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy("reopen") ? "Reopening…" : "Reopen Survey"}
        </button>
      )}

      {showResults ? (
        <Link
          href={`/surveys/${surveyId}/results`}
          className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 transition"
        >
          View Results
        </Link>
      ) : (
        <button
          type="button"
          onClick={handleToggleShare}
          disabled={busy("share") || isPending}
          className="inline-flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 hover:bg-amber-100 transition disabled:cursor-not-allowed disabled:opacity-70"
        >
          {busy("share") && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy("share") ? "Enabling…" : "Enable Data Sharing & View Results"}
        </button>
      )}
    </div>
  );
}