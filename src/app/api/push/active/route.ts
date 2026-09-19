import { NextResponse } from "next/server";
import { z } from "zod";
import { clearTabActive, markTabActive } from "@/lib/push-activity";
import { createClient } from "@/utils/supabase/server";

/**
 * Presence beacon for the push gate.
 *
 * The client reports `active: true` while a ScholarBase tab is visible and
 * `active: false` (via `navigator.sendBeacon`) the moment it is hidden or
 * closed. The send worker consults this state so OS notifications only fire
 * when the recipient is not using the app.
 *
 * The response is intentionally tiny and always 200 for authenticated beacons —
 * the client fires these fire-and-forget and must not pay for error handling.
 */

const bodySchema = z.object({
  tabId: z.string().min(1).max(64),
  active: z.boolean(),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid activity payload" }, { status: 400 });
  }

  const { tabId, active } = parsed.data;

  if (active) {
    await markTabActive(user.id, tabId);
  } else {
    await clearTabActive(user.id, tabId);
  }

  return NextResponse.json({ success: true });
}