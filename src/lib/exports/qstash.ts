import "server-only";

import { Client } from "@upstash/qstash";
import { requireEnv } from "@/lib/env";

export async function queueExportJob(jobId: string): Promise<void> {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) throw new Error("NEXT_PUBLIC_SITE_URL is not configured.");

  let destination: URL;
  try {
    destination = new URL(siteUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SITE_URL must be a valid URL.");
  }

  if (["localhost", "127.0.0.1", "::1"].includes(destination.hostname)) {
    if (process.env.NODE_ENV === "development") {
      // Run inline in dev so the flow works without a public QStash destination.
      const { processExportJob } = await import("@/lib/exports/processor");
      await processExportJob(jobId);
      return;
    }
    throw new Error("QStash destination must be publicly reachable in production.");
  }

  await new Client({ token: requireEnv("QSTASH_TOKEN") }).publishJSON({
    url: `${destination.toString().replace(/\/$/, "")}/api/jobs/export`,
    body: { jobId },
    retries: 3,
  });
}
