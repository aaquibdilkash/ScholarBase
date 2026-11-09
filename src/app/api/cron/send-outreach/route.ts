import { NextRequest, NextResponse } from "next/server";

import { verifyCronSecret } from "@/lib/cron";
import { runOutreachCron } from "@/lib/outreach/sender";

// Resend and Prisma both need the Node runtime; the worker also reads Redis.
export const runtime = "nodejs";
export const revalidate = 0;

const DEFAULT_LIMIT = 1;
const MAX_LIMIT = 3;

function parseLimit(value: string | null): number {
  if (!value) return DEFAULT_LIMIT;

  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return DEFAULT_LIMIT;

  return Math.min(MAX_LIMIT, Math.max(1, Math.trunc(parsed)));
}

function parseDryRun(value: string | null): boolean {
  if (!value) return false;

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

/**
 * Scheduled outreach send.
 *
 * Coolify runs this every 20 minutes. Each run usually sends zero or one
 * email: the worker rolls its send probability and only then picks an eligible
 * contact, so delivery times look human without a long-lived sleep.
 *
 * `?dryRun=1` reports the contact that would be chosen without sending, which
 * is how the selection is verified before the kill switch is flipped.
 */
export async function GET(request: NextRequest) {
  if (!(await verifyCronSecret())) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 },
    );
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const dryRun = parseDryRun(request.nextUrl.searchParams.get("dryRun"));

  try {
    const result = await runOutreachCron({ limit, dryRun });

    if (!result.success) {
      return NextResponse.json(result, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error("[cron/send-outreach]", error);
    return NextResponse.json(
      { success: false, sent: 0, error: "Outreach send failed." },
      { status: 500 },
    );
  }
}
