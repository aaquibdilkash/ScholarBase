-- P0-2 — make the email digest opt-IN.
--
-- Two changes, and the second is the one that matters.
--
-- 1. The column default.
--
-- 2. The EXISTING rows.
--
-- Step 2 is not optional. A `@default` only applies to rows created AFTER the
-- migration, so flipping it in schema.prisma alone would have left every
-- current account on DAILY — precisely the population that makes `runDigest`
-- time out. Existing users are exactly the people this change is meant to stop
-- emailing, so they are flipped here explicitly.
--
-- Why opt-IN rather than "keep DAILY but fix the batching":
--   * The batching fix (P0-2 phase 1C) is still required and still lands.
--   * But an unread-activity digest nobody asked for is spam by construction,
--     and the daily cadence is the expensive one. Opt-in means the daily job's
--     population is bounded by genuine intent, so the 100/day Resend wall stops
--     being a cliff that scales with signups.
--
-- What this deliberately does NOT do: touch WEEKLY or NEVER. Those rows were
-- chosen by the user (via the preference link in a digest email) and are left
-- alone. Only the implicit DAILY cohort is converted.
--
-- Safe because it is reversible: anyone who wants the digest back can switch it
-- on in /scholars/[id]/settings, which is the opt-in surface this migration
-- depends on shipping FIRST.
--
-- Reversal, if this ever needs undoing:
--   UPDATE "User" SET "digestPreference" = 'DAILY' WHERE "digestPreference" = 'NEVER';
-- (over-inclusive — it would also restore explicit opt-outs; scope by signup
-- date if that is ever needed.)

-- 1. New users default to no digest.
ALTER TABLE "User"
    ALTER COLUMN "digestPreference" SET DEFAULT 'NEVER';

-- 2. Existing implicitly-enrolled users stop being emailed.
UPDATE "User"
SET "digestPreference" = 'NEVER'
WHERE "digestPreference" = 'DAILY';
