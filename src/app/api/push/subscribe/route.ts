import { NextResponse } from "next/server";
import { z } from "zod";
import prisma from "@/lib/db";
import { createClient } from "@/utils/supabase/server";

/**
 * Registers / removes a browser's Web Push subscription.
 *
 * Uses `createClient()` + `getUser()` (the API-route convention in this repo)
 * instead of `requireCurrentUser` so an unauthenticated call returns 401 JSON
 * rather than a redirect.
 */

const subscribeSchema = z.object({
  action: z.literal("subscribe"),
  endpoint: z.string().min(1).max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(512),
    auth: z.string().min(1).max(512),
  }),
});

const unsubscribeSchema = z.object({
  action: z.literal("unsubscribe"),
  endpoint: z.string().min(1).max(2048),
});

const requestSchema = z.union([subscribeSchema, unsubscribeSchema]);

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

  const parsed = requestSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid push payload" }, { status: 400 });
  }

  if (parsed.data.action === "unsubscribe") {
    // Scoped by userId so one account can never revoke another's endpoint.
    await prisma.pushSubscription.deleteMany({
      where: { endpoint: parsed.data.endpoint, userId: user.id },
    });
    return NextResponse.json({ success: true });
  }

  const { endpoint, keys } = parsed.data;

  // Endpoints are globally unique per browser install: re-subscribing (or a
  // different account signing in on the same browser) reassigns ownership.
  await prisma.pushSubscription.upsert({
    where: { endpoint },
    create: {
      userId: user.id,
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: request.headers.get("user-agent")?.slice(0, 255) ?? null,
    },
    update: {
      userId: user.id,
      p256dh: keys.p256dh,
      auth: keys.auth,
      userAgent: request.headers.get("user-agent")?.slice(0, 255) ?? null,
      lastUsedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}