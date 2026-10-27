import type { UserIdentity } from "@supabase/supabase-js";

import { normalizeEmail } from "@/lib/email-normalizer";

/**
 * Which linked logins must be dropped after a primary-email change.
 *
 * Changing the primary email rewrites the `email` identity in place, so the old
 * address stops working for password sign-in on its own. OAuth identities are
 * different: they are matched by the provider's `sub`, never by email, and an
 * email change does not touch them. A Google account still holding the old
 * address therefore keeps opening the account after its owner deliberately
 * moved away from that address — an account-takeover path if the old mailbox
 * was lost or recycled.
 *
 * The rule is deliberately conservative:
 * - the `email` identity is never a candidate (it IS the new address);
 * - an identity whose email cannot be read is kept, never guessed at;
 * - if dropping every candidate would leave the account with no login method,
 *   nothing is dropped (Supabase also refuses to unlink the last identity, and
 *   a user must never be locked out by a security fix).
 */
export function staleOAuthIdentities<T extends UserIdentity>(
  identities: readonly T[],
  primaryEmail: string,
): T[] {
  const target = normalizeEmail(primaryEmail);
  if (!target) return [];

  const stale = identities.filter((identity) => {
    if (identity.provider === "email") return false;

    const identityEmail = readIdentityEmail(identity);
    if (!identityEmail) return false;

    return normalizeEmail(identityEmail) !== target;
  });

  if (stale.length === 0) return [];
  if (stale.length === identities.length) return [];

  return stale;
}

function readIdentityEmail(identity: UserIdentity): string {
  const value = identity.identity_data?.email;
  return typeof value === "string" ? value : "";
}
