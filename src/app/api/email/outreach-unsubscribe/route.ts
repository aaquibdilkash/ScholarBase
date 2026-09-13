import { NextResponse, type NextRequest } from "next/server";
import prisma from "@/lib/db";
import { normalizeEmail, validateEmailFormat } from "@/lib/email-normalizer";
import { verifyOutreachUnsubscribeToken } from "@/lib/emails/outreachUnsubscribe";

export const dynamic = "force-dynamic";

function readEmailAndToken(request: NextRequest) {
  const email = normalizeEmail(request.nextUrl.searchParams.get("email") ?? "");
  const token = request.nextUrl.searchParams.get("token");

  if (!validateEmailFormat(email)) {
    return null;
  }

  if (!verifyOutreachUnsubscribeToken(email, token)) {
    return null;
  }

  return { email };
}

async function unsubscribe(email: string) {
  await prisma.outreachEmailUnsubscribe.upsert({
    where: { email },
    update: {},
    create: { email },
  });
}

export async function POST(request: NextRequest) {
  const parsed = readEmailAndToken(request);

  if (!parsed) {
    return new Response(null, { status: 400 });
  }

  await unsubscribe(parsed.email);
  return new Response(null, { status: 202 });
}

export async function GET(request: NextRequest) {
  const parsed = readEmailAndToken(request);

  if (!parsed) {
    return new NextResponse(
      "<!doctype html><html><body><p>This unsubscribe link is invalid or expired.</p></body></html>",
      {
        status: 400,
        headers: { "Content-Type": "text/html; charset=utf-8" },
      },
    );
  }

  await unsubscribe(parsed.email);

  return new NextResponse(
    "<!doctype html><html><body><p>You will no longer receive ScholarBase outreach emails.</p></body></html>",
    {
      status: 200,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}
