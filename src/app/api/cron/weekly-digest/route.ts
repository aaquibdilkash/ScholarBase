import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron";

export async function GET() {
  if (!(await verifyCronSecret())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Kick off the first chunk only; the worker drains the rest via QStash, so
    // this invocation stays inside the function timeout regardless of how many
    // subscribers there are.
    const { kickoffDigest } = await import("@/lib/emails/digest");
    await kickoffDigest("WEEKLY");
    return NextResponse.json({ success: true, kickedOff: "WEEKLY" });
  } catch (error) {
    console.error("[cron/weekly-digest]", error);
    return NextResponse.json(
      { success: false, error: "Weekly digest kickoff failed" },
      { status: 500 }
    );
  }
}
