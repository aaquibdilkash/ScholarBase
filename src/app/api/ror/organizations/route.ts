import { NextResponse } from "next/server";

import { checkRateLimit, RATE_LIMIT_ERROR } from "@/lib/rate-limit";
import { createClient } from "@/utils/supabase/server";

export const dynamic = "force-dynamic";

const ROR_API = "https://api.ror.org/v2/organizations";

type RorRecord = {
  id?: unknown;
  names?: Array<{ value?: unknown; types?: unknown }>;
  locations?: Array<{ geonames_details?: { country_name?: unknown } }>;
};

function isRorId(value: unknown): value is string {
  return typeof value === "string" && /^https:\/\/ror\.org\/[0-9a-z]{9}$/i.test(value);
}

export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2) return NextResponse.json({ items: [] });
  if (query.length > 120) return NextResponse.json({ error: "Search is too long." }, { status: 400 });

  const limit = await checkRateLimit({
    namespace: "ror:search",
    key: user.id,
    limit: 30,
    window: "1 m",
    onDegraded: "open",
  });
  if (!limit.allowed) return NextResponse.json({ error: RATE_LIMIT_ERROR }, { status: 429 });

  const upstream = new URL(ROR_API);
  upstream.searchParams.set("query", query);
  const response = await fetch(upstream, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) return NextResponse.json({ error: "ROR search is temporarily unavailable." }, { status: 502 });

  const payload = (await response.json()) as { items?: RorRecord[] };
  const items = (payload.items ?? [])
    .filter((record) => isRorId(record.id))
    .slice(0, 8)
    .map((record) => ({
      id: record.id,
      name: record.names?.find((name) => Array.isArray(name.types) && name.types.includes("ror_display"))?.value ?? record.names?.[0]?.value,
      country: record.locations?.[0]?.geonames_details?.country_name ?? null,
    }))
    .filter((record): record is { id: string; name: string; country: string | null } => typeof record.name === "string" && record.name.trim().length > 0);

  return NextResponse.json({ items }, { headers: { "Cache-Control": "private, max-age=300" } });
}
