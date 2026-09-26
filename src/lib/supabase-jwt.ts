import { type User as SupabaseUser } from "@supabase/supabase-js";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

const BASE64_PREFIX = "base64-";
const EXPIRATION_BUFFER_SEC = 10;
const jwksCache = new Map<string, JWTVerifyGetKey>();

export interface CookieLike {
  name: string;
  value: string;
}

export function getSupabaseAuthTokenCookieName(
  supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || "",
): string | null {
  if (!supabaseUrl) return null;
  try {
    const parsed = new URL(supabaseUrl);
    const ref = parsed.hostname.split(".")[0];
    if (!ref) return null;
    return `sb-${ref}-auth-token`;
  } catch {
    return null;
  }
}

export function reassembleCookieChunks(
  cookies: CookieLike[],
  baseName: string,
): string | null {
  if (!baseName || !cookies || cookies.length === 0) return null;

  const prefix = `${baseName}.`;
  const chunks = cookies
    .filter((c) => c.name.startsWith(prefix))
    .map((c) => {
      const suffix = c.name.slice(prefix.length);
      const index = parseInt(suffix, 10);
      return { value: c.value, index };
    })
    .filter((item) => !Number.isNaN(item.index))
    .sort((a, b) => a.index - b.index);

  if (chunks.length > 0) {
    return chunks.map((c) => c.value).join("");
  }

  const exact = cookies.find((c) => c.name === baseName);
  return exact ? exact.value : null;
}

export function decodeSessionCookieValue(rawCookieValue: string): string | null {
  if (!rawCookieValue) return null;
  if (!rawCookieValue.startsWith(BASE64_PREFIX)) {
    return rawCookieValue;
  }

  const encoded = rawCookieValue.slice(BASE64_PREFIX.length);
  try {
    return Buffer.from(encoded, "base64url").toString("utf-8");
  } catch {
    return null;
  }
}

export function extractAccessTokenFromCookies(
  cookies: CookieLike[],
  baseName?: string,
): string | null {
  const tokenCookieName = baseName || getSupabaseAuthTokenCookieName();
  if (!tokenCookieName) return null;

  const rawValue = reassembleCookieChunks(cookies, tokenCookieName);
  if (!rawValue) return null;

  const decoded = decodeSessionCookieValue(rawValue);
  if (!decoded) return null;

  try {
    const sessionObj = JSON.parse(decoded);
    if (typeof sessionObj === "object" && sessionObj !== null && typeof sessionObj.access_token === "string") {
      return sessionObj.access_token;
    }
    if (typeof sessionObj === "string") {
      return sessionObj;
    }
  } catch {
    if (decoded.split(".").length === 3) {
      return decoded;
    }
  }

  return null;
}

export function isJwtExpired(token: string, bufferSeconds = EXPIRATION_BUFFER_SEC): boolean {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return true;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    if (typeof payload.exp !== "number") return false;
    const now = Math.floor(Date.now() / 1000);
    return payload.exp <= now + bufferSeconds;
  } catch {
    return true;
  }
}

export function getOrCreateRemoteJWKS(supabaseUrl: string = process.env.NEXT_PUBLIC_SUPABASE_URL || ""): JWTVerifyGetKey | null {
  if (!supabaseUrl) return null;
  const normalizedUrl = supabaseUrl.replace(/\/+$/, "");
  const jwksUrl = `${normalizedUrl}/auth/v1/.well-known/jwks.json`;

  const existing = jwksCache.get(jwksUrl);
  if (existing) return existing;

  try {
    const jwks = createRemoteJWKSet(new URL(jwksUrl), {
      cooldownDuration: 30_000,
      cacheMaxAge: 600_000,
    });
    jwksCache.set(jwksUrl, jwks);
    return jwks;
  } catch {
    return null;
  }
}

export function mapJwtPayloadToUser(payload: Record<string, unknown>): SupabaseUser | null {
  const id = typeof payload.sub === "string" ? payload.sub : null;
  if (!id) return null;

  const aud = typeof payload.aud === "string" ? payload.aud : "authenticated";
  const role = typeof payload.role === "string" ? payload.role : undefined;
  const email = typeof payload.email === "string" ? payload.email : undefined;
  const phone = typeof payload.phone === "string" ? payload.phone : undefined;

  const appMetadata =
    typeof payload.app_metadata === "object" && payload.app_metadata !== null
      ? (payload.app_metadata as Record<string, unknown>)
      : {};
  const userMetadata =
    typeof payload.user_metadata === "object" && payload.user_metadata !== null
      ? (payload.user_metadata as Record<string, unknown>)
      : {};

  const createdAt =
    typeof payload.iat === "number"
      ? new Date(payload.iat * 1000).toISOString()
      : new Date().toISOString();

  return {
    id,
    aud,
    role,
    email,
    phone,
    app_metadata: appMetadata,
    user_metadata: userMetadata,
    created_at: createdAt,
  } as SupabaseUser;
}

export async function verifySupabaseTokenLocally(
  token: string,
  options?: {
    supabaseUrl?: string;
    jwks?: JWTVerifyGetKey;
  },
): Promise<SupabaseUser | null> {
  if (!token || isJwtExpired(token)) {
    return null;
  }

  const supabaseUrl = (options?.supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || "").replace(/\/+$/, "");
  const jwks = options?.jwks || getOrCreateRemoteJWKS(supabaseUrl);
  if (!jwks) return null;

  try {
    const expectedIssuer = supabaseUrl ? `${supabaseUrl}/auth/v1` : undefined;
    const { payload } = await jwtVerify(token, jwks, {
      issuer: expectedIssuer,
      audience: "authenticated",
    });

    return mapJwtPayloadToUser(payload as Record<string, unknown>);
  } catch {
    return null;
  }
}

export async function verifyUserFromCookies(
  cookies: CookieLike[],
  options?: {
    supabaseUrl?: string;
    baseName?: string;
    jwks?: JWTVerifyGetKey;
  },
): Promise<SupabaseUser | null> {
  const token = extractAccessTokenFromCookies(cookies, options?.baseName);
  if (!token) return null;

  return verifySupabaseTokenLocally(token, options);
}
