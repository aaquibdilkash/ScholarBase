import "server-only";

import { createClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client.
 *
 * Used ONLY for administrative Storage operations that no user session can
 * authorise — currently the orphaned-asset cleanup cron, which deletes objects
 * belonging to users who are not signed in.
 *
 * The service role BYPASSES row-level security, so every caller must
 * constrain the paths it deletes to objects the application owns. The cleanup
 * job only ever deletes paths it read out of the `OrphanedAsset` queue, which
 * is populated by the trim cron from the content's own stored rows.
 *
 * Never import this from a client component, and never expose the key.
 */
export function createServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "Supabase service-role credentials are not configured. " +
        "Set SUPABASE_SERVICE_ROLE_KEY to run administrative Storage jobs.",
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * True when the service-role credentials are present. Lets a job degrade with
 * a clear message instead of a stack trace.
 */
export function hasServiceRoleCredentials(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY),
  );
}
