const TURNSTILE_VERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";
const TURNSTILE_ACTION = "institution-domain-request";

type TurnstileVerificationResponse = {
  success: boolean;
  action?: string;
};

export async function verifyInstitutionRequestTurnstile(
  token: string,
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
    return result.success && result.action === TURNSTILE_ACTION;
  } catch {
    return false;
  }
}
