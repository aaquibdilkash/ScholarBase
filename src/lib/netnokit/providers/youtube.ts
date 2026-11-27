import "server-only";

import { parseNetnoKitUrl } from "@/lib/netnokit/urls";
import type { NetnoKitComment } from "@/lib/netnokit/types";
import { anonymizeAuthorId, cleanText } from "@/lib/netnokit/anonymize";

const API_BASE = "https://www.googleapis.com/youtube/v3";

export type YouTubeCollectOptions = {
  url: string;
  apiKey: string;
  maxComments: number;
  includeReplies: boolean;
  anonymize: boolean;
  studySalt: string;
};

export async function collectYouTube(opts: YouTubeCollectOptions): Promise<NetnoKitComment[]> {
  const parsed = parseNetnoKitUrl(opts.url);
  if (!parsed || parsed.platform !== "youtube") throw new Error("Not a YouTube URL");
  const { videoId } = parsed;

  const headers: HeadersInit = { "X-Goog-Api-Key": opts.apiKey, Accept: "application/json" };
  const out: NetnoKitComment[] = [];
  let pageToken: string | undefined;
  let fetched = 0;

  while (fetched < opts.maxComments) {
    const remaining = opts.maxComments - fetched;
    const pageSize = Math.min(100, remaining);
    const u = new URL(`${API_BASE}/commentThreads`);
    u.searchParams.set("part", "snippet,replies");
    u.searchParams.set("videoId", videoId);
    u.searchParams.set("maxResults", String(pageSize));
    u.searchParams.set("order", "time");
    u.searchParams.set("textFormat", "plainText");
    if (pageToken) u.searchParams.set("pageToken", pageToken);

    const res = await fetch(u, { headers, signal: AbortSignal.timeout(25000) });
    if (!res.ok) throw new Error(`YouTube API ${res.status}`);
    const data = (await res.json()) as {
      items?: Array<{
        id: string;
        snippet: {
          topLevelComment: {
            id: string;
            snippet: {
              authorDisplayName: string;
              authorChannelId?: { value: string };
              textDisplay: string;
              likeCount: number;
              publishedAt: string;
              updatedAt: string;
            };
          };
          totalReplyCount: number;
        };
        replies?: { comments?: Array<{ id: string; snippet: { authorDisplayName: string; authorChannelId?: { value: string }; textDisplay: string; likeCount: number; publishedAt: string; updatedAt: string } }> };
      }>;
      nextPageToken?: string;
    };

    for (const thread of data.items ?? []) {
      if (fetched >= opts.maxComments) break;
      const top = thread.snippet.topLevelComment;
      const topId = top.id;
      const authorId = top.snippet.authorChannelId?.value ?? null;
      out.push({
        commentId: topId,
        parentId: null,
        threadRootId: topId,
        depth: 0,
        authorId: opts.anonymize ? anonymizeAuthorId(opts.studySalt, "youtube", authorId, top.snippet.authorDisplayName) : authorId,
        authorUsername: opts.anonymize ? null : (top.snippet.authorDisplayName ?? null),
        authorDisplayName: top.snippet.authorDisplayName ?? null,
        createdAt: top.snippet.publishedAt,
        updatedAt: top.snippet.updatedAt,
        likeCount: top.snippet.likeCount ?? 0,
        replyCount: thread.snippet.totalReplyCount ?? 0,
        isDeleted: false,
        permalink: `https://www.youtube.com/watch?v=${videoId}&lc=${topId}`,
        text: top.snippet.textDisplay,
        cleanedText: cleanText(top.snippet.textDisplay),
      });
      fetched++;

      if (opts.includeReplies && thread.replies?.comments) {
        for (const reply of thread.replies.comments) {
          if (fetched >= opts.maxComments) break;
          const rAuthorId = reply.snippet.authorChannelId?.value ?? null;
          out.push({
            commentId: reply.id,
            parentId: topId,
            threadRootId: topId,
            depth: 1,
            authorId: opts.anonymize ? anonymizeAuthorId(opts.studySalt, "youtube", rAuthorId, reply.snippet.authorDisplayName) : rAuthorId,
            authorUsername: opts.anonymize ? null : (reply.snippet.authorDisplayName ?? null),
            authorDisplayName: reply.snippet.authorDisplayName ?? null,
            createdAt: reply.snippet.publishedAt,
            updatedAt: reply.snippet.updatedAt,
            likeCount: reply.snippet.likeCount ?? 0,
            replyCount: 0,
            isDeleted: false,
            permalink: `https://www.youtube.com/watch?v=${videoId}&lc=${reply.id}`,
            text: reply.snippet.textDisplay,
            cleanedText: cleanText(reply.snippet.textDisplay),
          });
          fetched++;
        }
      }
    }

    pageToken = data.nextPageToken;
    if (!pageToken) break;
  }

  return out;
}
