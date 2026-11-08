"use server";

import { getActiveUser } from "@/lib/auth";
import { checkRateLimit, RATE_LIMIT_DEGRADED_ERROR, RATE_LIMIT_ERROR } from "@/lib/rate-limit";
import prisma from "@/lib/db";
import { TRANSACTION_OPTIONS } from "@/lib/transactions";
import type { ShieldUsage } from "@prisma/client";

export type ShieldUseInput = {
  tool: "DETECTOR" | "REWRITER";
  model: string;
  overallScore?: number | null;
  neuralScore?: number | null;
  cadenceScore?: number | null;
};

export type ShieldUseResult =
  | { success: true; data: ShieldUsage }
  | { success: false; error: string };

/** Scores are percentages: clamp to 0–100 and round; drop anything non-numeric. */
function normalizeScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/**
 * Persists one Scholar Shield use (detector scan or rewriter run).
 *
 * The returned row's `id` is the cuid printed on the PDF, so the caller can use
 * it as the report ID. The write and the user's materialized counters move in a
 * single transaction — an audit row is never left behind without the counter.
 *
 * The viewer always comes from the session; there is deliberately no user id
 * parameter, so a client cannot attribute usage to another scholar.
 */
export async function recordShieldUse(
  input: ShieldUseInput,
): Promise<ShieldUseResult> {
  const auth = await getActiveUser("You must be logged in to use Scholar Shield.");
  if (auth.frozen) {
    return {
      success: false,
      error:
        "Your account is frozen. You are restricted from using Scholar Shield.",
    };
  }
  const user = auth.user;

  const tool = input?.tool;
  if (tool !== "DETECTOR" && tool !== "REWRITER") {
    return { success: false, error: "Invalid Scholar Shield tool." };
  }

  const model = typeof input?.model === "string" ? input.model.trim() : "";
  if (!model) {
    return { success: false, error: "Missing Scholar Shield model." };
  }

  const rateLimit = await checkRateLimit({
    namespace: `shield:use:${tool.toLowerCase()}`,
    key: user.id,
    limit: 120,
    window: "1 m",
    onDegraded: "closed",
  });
  if (!rateLimit.allowed) {
    return {
      success: false,
      error: rateLimit.degraded ? RATE_LIMIT_DEGRADED_ERROR : RATE_LIMIT_ERROR,
    };
  }

  try {
    const usage = await prisma.$transaction(async (tx) => {
      const created = await tx.shieldUsage.create({
        data: {
          userId: user.id,
          tool,
          model,
          overallScore: normalizeScore(input.overallScore),
          neuralScore: normalizeScore(input.neuralScore),
          cadenceScore: normalizeScore(input.cadenceScore),
        },
      });

      await tx.user.update({
        where: { id: user.id },
        data: {
          ...(tool === "DETECTOR"
            ? { shieldDetectorUses: { increment: 1 } }
            : { shieldRewriterUses: { increment: 1 } }),
          shieldTotalUses: { increment: 1 },
        },
      });

      return created;
    }, TRANSACTION_OPTIONS);

    return { success: true, data: usage };
  } catch (error) {
    console.error("Error recording Scholar Shield use:", error);
    return { success: false, error: "An unexpected error occurred." };
  }
}
