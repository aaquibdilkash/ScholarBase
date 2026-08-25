import { NextResponse, type NextRequest } from "next/server";
import type { DigestPreference } from "@prisma/client";
import prisma from "@/lib/db";
import { verifyPreferenceToken } from "@/lib/emails/digest";

const VALID_PREFS = ["WEEKLY", "NEVER"] as const;
type ValidPref = (typeof VALID_PREFS)[number];

// One-click preference update from digest email footers.
// GET /api/notifications/update-preference?userId=...&pref=WEEKLY&token=...
export async function GET(request: NextRequest) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin;

  const userId = request.nextUrl.searchParams.get("userId");
  const pref = request.nextUrl.searchParams.get("pref");
  const token = request.nextUrl.searchParams.get("token");

  if (!userId || !pref || !token) {
    return NextResponse.redirect(`${appUrl}/?digest=invalid`);
  }

  const isValidPref = VALID_PREFS.includes(pref as ValidPref);
  if (!isValidPref || !verifyPreferenceToken(userId, pref, token)) {
    return NextResponse.redirect(`${appUrl}/?digest=invalid`);
  }

  try {
    const user = await prisma.user.update({
      where: { id: userId },
      data: { digestPreference: pref as DigestPreference },
      select: { id: true },
    });

    if (!user) throw new Error("User not found");

    return NextResponse.redirect(`${appUrl}/?digest=${pref === "NEVER" ? "unsubscribed" : "weekly"}`);
  } catch (error) {
    console.error("[notifications/update-preference]", error);
    return NextResponse.redirect(`${appUrl}/?digest=error`);
  }
}
