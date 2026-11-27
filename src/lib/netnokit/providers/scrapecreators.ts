import "server-only";

import { parseNetnoKitUrl } from "@/lib/netnokit/urls";
import type { NetnoKitComment } from "@/lib/netnokit/types";
import { anonymizeAuthorId, cleanText } from "@/lib/netnokit/anonymize";

const API_BASE = "https://api.scrapecreators.com/v2/instagram/post/comments";

export type ScrapeCreatorsCollectOptions = {
  url: string;
  apiKey: string;
  maxComments: number;
  includeReplies: boolean;
  anonymize: boolean;
  studySalt: string;
};

export async function collectScrapeCreators(opts: ScrapeCreatorsCollectOptions): Promise<NetnoKitComment[]> {
  const parsed = parseNetnoKitUrl(opts.url);
  if (!parsed || parsed.platform !== "instagram") throw new Error("Not an Instagram URL");

  const out: NetnoKitComment[] = [];
  let cursor: string | undefined;
  let fetched = 0;

  while (fetched < opts.maxComments) {
    const u = new URL(API_BASE);
    u.searchParams.set("url", opts.url);
    if (cursor) u.searchParams.set("cursor", cursor);
    if (opts.includeReplies) u.searchParams.set("include_replies", "true");

    const res = await fetch(u, {
      headers: { "x-api-key": opts.apiKey, Accept: "application/json" },
      signal: AbortSignal.timeout(30000),
    });
    if (!res.ok) throw new Error(`ScrapeCreators API ${res.status}`);
    const data = (await res.json()) as {
      comments?: Array<{
        id: string;
        text: string;
        created_at?: string;
        comment_like_count?: number;
        user?: { username?: string; full_name?: string; id?: string };
        parent_id?: string | null;
      }>;
      cursor?: string | null;
    };

    for (const c of data.comments ?? []) {
      if (fetched >= opts.maxComments) break;
      const authorId = c.user?.id ?? c.user?.username ?? null;
      const parentId = c.parent_id ?? null;
      out.push({
        commentId: c.id,
        parentId,
        threadRootId: parentId ?? c.id,
        depth: parentId ? 1 : 0,
        authorId: opts.anonymize ? anonymizeAuthorId(opts.studySalt, "instagram", authorId, c.user?.username ?? "unknown") : authorId,
        authorUsername: opts.anonymize ? null : (c.user?.username ?? null),
        authorDisplayName: c.user?.full_name ?? c.user?.username ?? null,
        createdAt: c.created_at ? new Date(c.created_at).toISOString() : new Date().toISOString(),
        updatedAt: null,
        likeCount: c.comment_like_count ?? 0,
        replyCount: 0,
        isDeleted: false,
        permalink: null,
        text: c.text ?? "",
        cleanedText: cleanText(c.text ?? ""),
      });
      fetched++;
    }

    cursor = data.cursor ?? undefined;
    if (!cursor || (data.comments ?? []).length === 0) break;
  }

  return out;
}
