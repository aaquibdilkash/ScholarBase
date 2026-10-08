const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Widget actions. The server checks `result.action === expected` so a token
 * minted for one form (the public domain-request widget) cannot be replayed
 * against another (the contact form). Keep these in sync with the `action`
 * passed to `window.turnstile.render` in each widget.
 */
export const INSTITUTION_TURNSTILE_ACTION = "institution-domain-request";
export const CONTACT_FORM_TURNSTILE_ACTION = "contact-form";

type TurnstileVerificationResponse = {
  success: boolean;
  action?: string;
};

/**
 * Shared verifier. Fails closed: missing secret, empty/oversized token,
 * non-OK response, verification failure, or an action mismatch all return
 * false. `expectedAction` is mandatory on purpose — a verifier without one
 * would accept tokens minted for any other widget on the site.
 */
export async function verifyTurnstileToken(
  token: string,
  expectedAction: string,
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !token || token.length > 2048) return false;

  try {
    const response = await fetch(TURNSTILE_VERIFY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        secret,
        response: token,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(5_000),
    });

    if (!response.ok) return false;

    const result = (await response.json()) as TurnstileVerificationResponse;
    return result.success && result.action === expectedAction;
  } catch {
    return false;
  }
}

export async function verifyInstitutionRequestTurnstile(
  token: string,
): Promise<boolean> {
  return verifyTurnstileToken(token, INSTITUTION_TURNSTILE_ACTION);
}

export async function verifyContactFormTurnstile(
  token: string,
): Promise<boolean> {
  return verifyTurnstileToken(token, CONTACT_FORM_TURNSTILE_ACTION);
}
