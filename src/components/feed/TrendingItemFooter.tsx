import { MessageCircle } from "lucide-react";
import { VoteButton } from "@/components/interactions/VoteButton";
import Link from "next/link";

type FooterItem = {
  id: string;
  type:
    | "vacancy"
    | "admission"
    | "event"
    | "help"
    | "journal"
    | "researchTool"
    | "contribution";
  totalVotes: number;
  totalComments: number;
  isFrozen?: boolean;
};

export function TrendingItemFooter({ item }: { item: FooterItem }) {
  const { type, id } = item;
  const detailUrl = `/${
    type === "vacancy"
      ? "vacancies"
      : type === "admission"
        ? "admissions"
        : type === "help"
          ? "help"
          : type === "journal"
            ? "journals"
            : type === "researchTool"
              ? "research-tools"
              : type === "contribution"
                ? "contributions"
                : "events"
  }/${id}`;

  return (
    <div className="flex items-center gap-6">
      <VoteButton
        frozen={item.isFrozen === true}
        targetId={item.id}
        module={
          type === "vacancy"
            ? "JOB_VACANCY"
            : type === "admission"
              ? "PHD_ADMISSION"
              : type === "help"
                ? "HELP_POST"
                : type === "journal"
                  ? "JOURNAL"
                  : type === "researchTool"
                    ? "RESEARCH_TOOL"
                    : type === "contribution"
                      ? "CONTRIBUTION"
                      : "RESEARCH_EVENT"
        }
        initialTotalVotes={item.totalVotes ?? 0}
        initialUserVote={null}
      />
      <Link
        href={detailUrl}
        className="flex items-center gap-2 text-sm font-semibold text-slate-500 transition-colors hover:text-blue-700"
      >
        <MessageCircle className="w-5 h-5" />
        {item.totalComments} Comments
      </Link>
    </div>
  );
}
