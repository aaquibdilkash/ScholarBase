"use client";

import { renderMentionContent } from "@/components/interactions/MentionComposer";

export function PostContent({ content, mentions }: { content: string; mentions?: unknown }) {
  return (
    <span className="text-base break-words sm:text-lg whitespace-pre-wrap leading-relaxed text-slate-800">
      {renderMentionContent(content, mentions)}
    </span>
  );
}
