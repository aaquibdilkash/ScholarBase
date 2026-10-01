import { NextResponse } from "next/server";
import { verifyCronSecret } from "@/lib/cron";

export async function GET() {
  if (!(await verifyCronSecret())) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Kick off the first chunk only. The worker drains the rest via QStash, so
    // this invocation stays inside the function timeout no matter how many
    // subscribers there are.
    const { kickoffDigest } = await import("@/lib/emails/digest");
    await kickoffDigest("DAILY");
    return NextResponse.json({ success: true, kickedOff: "DAILY" });
  } catch (error) {
    console.error("[cron/daily-digest]", error);
    return NextResponse.json(
      { success: false, error: "Daily digest kickoff failed" },
      { status: 500 }
    );
  }
}
