import { NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/utils/supabase/server";
import { checkRateLimit, RATE_LIMIT_DEGRADED_ERROR, RATE_LIMIT_ERROR } from "@/lib/rate-limit";
import { parseNetnoKitUrl } from "@/lib/netnokit/urls";
import { collectYouTube } from "@/lib/netnokit/providers/youtube";
import { collectScrapeCreators } from "@/lib/netnokit/providers/scrapecreators";
import { requireEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const bodySchema = z.object({
  url: z.string().trim().min(1).max(2048),
  provider: z.enum(["youtube-shared", "youtube-byok", "scrapecreators"]).default("youtube-shared"),
  apiKey: z.string().trim().max(256).optional(),
  maxComments: z.number().int().min(1).max(10000).default(1000),
  includeReplies: z.boolean().default(false),
  anonymize: z.boolean().default(true),
  studySalt: z.string().trim().min(8).max(64).default(() => crypto.randomUUID()),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await checkRateLimit({
    namespace: "netnokit:collect",
    key: user.id,
    limit: 6,
    window: "10 m",
    onDegraded: "closed",
  });
  if (!limit.allowed) {
    return NextResponse.json(
      { error: limit.degraded ? RATE_LIMIT_DEGRADED_ERROR : RATE_LIMIT_ERROR },
      { status: limit.degraded ? 503 : 429 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Malformed JSON" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
  const input = parsed.data;

  const parsedUrl = parseNetnoKitUrl(input.url);
  if (!parsedUrl) {
    return NextResponse.json({ error: "Unsupported URL" }, { status: 400 });
  }

  try {
    let comments;
    let providerLabel: string;
    if (parsedUrl.platform === "youtube") {
      const apiKey =
        input.provider === "youtube-byok"
          ? (input.apiKey ?? "")
          : requireEnv("YOUTUBE_API_KEY", "");
      if (!apiKey) {
        return NextResponse.json(
          { error: "No YouTube API key available. Add your own key or configure YOUTUBE_API_KEY." },
          { status: 400 },
        );
      }
      comments = await collectYouTube({
        url: input.url,
        apiKey,
        maxComments: input.maxComments,
        includeReplies: input.includeReplies,
        anonymize: input.anonymize,
        studySalt: input.studySalt,
      });
      providerLabel = input.provider === "youtube-byok" ? "YouTube (BYOK)" : "YouTube (ScholarBase key)";
    } else {
      if (input.provider !== "scrapecreators" || !input.apiKey) {
        return NextResponse.json({ error: "ScrapeCreators API key required for Instagram" }, { status: 400 });
      }
      comments = await collectScrapeCreators({
        url: input.url,
        apiKey: input.apiKey,
        maxComments: input.maxComments,
        includeReplies: input.includeReplies,
        anonymize: input.anonymize,
        studySalt: input.studySalt,
      });
      providerLabel = "ScrapeCreators";
    }

    const metadata = {
      platform: parsedUrl.platform,
      sourceUrl: input.url,
      videoId: parsedUrl.platform === "youtube" ? parsedUrl.videoId : undefined,
      shortcode: parsedUrl.platform === "instagram" ? parsedUrl.shortcode : undefined,
      collectedAt: new Date().toISOString(),
      provider: providerLabel,
      params: {
        maxComments: input.maxComments,
        includeReplies: input.includeReplies,
        anonymize: input.anonymize,
      },
      totalComments: comments.length,
      truncated: comments.length >= input.maxComments,
    };

    return NextResponse.json({ comments, metadata });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Collection failed";
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
