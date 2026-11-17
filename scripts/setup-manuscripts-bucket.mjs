#!/usr/bin/env node
/**
 * scripts/setup-manuscripts-bucket.mjs
 *
 * Creates (or repairs) the private Supabase Storage bucket that holds
 * manuscript PDFs. Run once per environment, before the first submission:
 *
 *   npm run storage:manuscripts
 *
 * Reads `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or the
 * legacy `SUPABASE_SERVICE_KEY`) from the environment, then `.env.local`, then
 * `.env`. The service role is required because creating a bucket and setting
 * its limits is an administrative Storage operation.
 *
 * Deliberately creates NO storage policies: the bucket is private and the app
 * reads/writes it exclusively through short-lived signed URLs minted by the
 * server. Do not make this bucket public — unpublished manuscripts must never
 * be readable from a URL.
 *
 * Limits mirror `src/lib/publishing/constants.ts`. If a cap changes there,
 * change it here and re-run.
 */
import { existsSync, readFileSync } from "node:fs";

import { createClient } from "@supabase/supabase-js";

const BUCKET = "manuscripts";
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ["application/pdf"];

function loadEnvFile(path) {
  if (!existsSync(path)) return;

  for (const rawLine of readFileSync(path, "utf8").split(/\r?\n/)) {
    let line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    if (line.startsWith("export ")) line = line.slice("export ".length);

    const separator = line.indexOf("=");
    if (separator <= 0) continue;

    const key = line.slice(0, separator).trim();
    if (!key || process.env[key] !== undefined) continue;

    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

if (!url || !serviceRoleKey) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY.\n" +
      "Add them to .env.local, or prefix the command:\n" +
      "  NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run storage:manuscripts",
  );
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// The URL is a public value (`NEXT_PUBLIC_*`), and printing it is the only way
// to catch the expensive mistake of creating the bucket in the wrong project.
console.log(`Target Supabase project: ${url}`);

const options = {
  public: false,
  fileSizeLimit: MAX_BYTES,
  allowedMimeTypes: ALLOWED_MIME_TYPES,
};

function fail(message) {
  console.error(`\n✖ ${message}\n`);
  process.exit(1);
}

function describe(bucket) {
  return {
    public: bucket.public,
    sizeLimit: bucket.file_size_limit ?? null,
    mimeTypes: bucket.allowed_mime_types ?? null,
  };
}

async function main() {
  const listed = await supabase.storage.listBuckets();
  if (listed.error) fail(`Could not list buckets: ${listed.error.message}`);

  const existing = listed.data?.find((bucket) => bucket.name === BUCKET);

  if (existing) {
    const current = describe(existing);
    const alreadyCorrect =
      current.public === false &&
      current.sizeLimit === MAX_BYTES &&
      Array.isArray(current.mimeTypes) &&
      current.mimeTypes.length === 1 &&
      current.mimeTypes[0] === "application/pdf";

    if (alreadyCorrect) {
      console.log(`✔ Private bucket "${BUCKET}" already configured.`);
      return;
    }

    const updated = await supabase.storage.updateBucket(BUCKET, options);
    if (updated.error) fail(`Could not update "${BUCKET}": ${updated.error.message}`);
    console.log(`✔ Updated bucket "${BUCKET}" to private, 25 MB, PDF-only.`);
    return;
  }

  const created = await supabase.storage.createBucket(BUCKET, options);
  if (created.error) fail(`Could not create "${BUCKET}": ${created.error.message}`);
  console.log(`✔ Created private bucket "${BUCKET}" (25 MB, PDF-only).`);
}

await main();

const verified = await supabase.storage.getBucket(BUCKET);
if (verified.error || !verified.data) {
  fail(`Bucket "${BUCKET}" could not be read back: ${verified.error?.message ?? "unknown error"}`);
}

const state = describe(verified.data);
console.log(
  `  public=${state.public} · sizeLimit=${state.sizeLimit} · allowed=${(state.mimeTypes ?? []).join(",") || "none"}`,
);
console.log(
  "  No storage policies were created: uploads and downloads use signed URLs only.",
);
