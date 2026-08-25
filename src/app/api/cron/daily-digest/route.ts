import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron";
import { runDigest } from "@/lib/emails/digest";

export async function GET() {
  if (!(await verifyCronSecret())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDigest("DAILY");
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    console.error("[cron/daily-digest]", error);
    return NextResponse.json(
      { success: false, error: "Daily digest failed" },
      { status: 500 }
    );
  }
}
