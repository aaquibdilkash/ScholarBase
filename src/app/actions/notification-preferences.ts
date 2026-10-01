"use server";

import prisma from "@/lib/db";
import { requireActiveUser } from "@/lib/auth";

/**
 * The three digest cadences. Mirrors the `DigestPreference` enum, but as a
 * hand-written list so the boundary check can reject anything else — the enum
 * arrives as a plain `string` from a client form, and writing it straight to
 * Prisma would let a hand-crafted call set an unrecognised value.
 */
const VALID_PREFERENCES = ["DAILY", "WEEKLY", "NEVER"] as const;
type DigestPreferenceInput = (typeof VALID_PREFERENCES)[number];

type DigestPreferenceResult =
  | { success: true; data: { digestPreference: DigestPreferenceInput } }
  | { success: false; error: string };

/**
 * Sets the caller's own digest cadence.
 *
 * Why this exists at all: until now `digestPreference` had NO writer outside
 * the emailed `update-preference` link, whose valid values are only WEEKLY and
 * NEVER. That made the digest strictly opt-OUT, and flipping the schema default
 * to opt-in would have made it opt-out-to-never: a user on NEVER receives no
 * digest, therefore no link, therefore no way to ever discover the feature.
 * This is the opt-IN surface that makes an opt-in default safe.
 *
 * RULE 1 identity contract: the viewer comes from the session and there is
 * deliberately NO user id parameter, so this cannot be pointed at someone
 * else's account from the browser.
 */
export async function updateDigestPreference(
  preference: string,
): Promise<DigestPreferenceResult> {
  const user = await requireActiveUser(
    "You must be logged in to change your digest preference.",
  );

  const normalized = preference?.trim().toUpperCase() as DigestPreferenceInput;
  if (!VALID_PREFERENCES.includes(normalized)) {
    return {
      success: false,
      error: "Choose a valid digest frequency.",
    };
  }

  const updated = await prisma.user.update({
    where: { id: user.id },
    data: { digestPreference: normalized },
    select: { digestPreference: true },
  });

  // No cache purge: the cadence is personal and affects only the two digest
  // crons, which read it straight from the database. There is no cached list
  // that embeds it.

  // RULE 1: return the persisted value, not the input, so the client renders
  // what the database actually holds rather than what it hoped to write.
  return {
    success: true,
    data: { digestPreference: updated.digestPreference as DigestPreferenceInput },
  };
}

/** The current caller's cadence, for rendering the initial radio state. */
export async function getDigestPreference(): Promise<DigestPreferenceInput> {
  const user = await requireActiveUser(
    "You must be logged in to view your digest preference.",
  );
  const row = await prisma.user.findUnique({
    where: { id: user.id },
    select: { digestPreference: true },
  });
  return (row?.digestPreference ?? "NEVER") as DigestPreferenceInput;
}
