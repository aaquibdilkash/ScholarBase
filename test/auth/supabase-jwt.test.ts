import { describe, expect, it } from "vitest";
import { exportJWK, generateKeyPair, SignJWT } from "jose";
import {
  decodeSessionCookieValue,
  extractAccessTokenFromCookies,
  getOrCreateRemoteJWKS,
  getSupabaseAuthTokenCookieName,
  isJwtExpired,
  mapJwtPayloadToUser,
  reassembleCookieChunks,
  verifySupabaseTokenLocally,
  verifyUserFromCookies,
} from "@/lib/supabase-jwt";

describe("supabase-jwt", () => {
  describe("getSupabaseAuthTokenCookieName", () => {
    it("derives cookie name from Supabase project URL hostname", () => {
      expect(
        getSupabaseAuthTokenCookieName("https://uqutnofemlmqkyvjzocy.supabase.co"),
      ).toBe("sb-uqutnofemlmqkyvjzocy-auth-token");
    });

    it("returns null for empty or invalid URL", () => {
      expect(getSupabaseAuthTokenCookieName("")).toBeNull();
      expect(getSupabaseAuthTokenCookieName("not-a-valid-url")).toBeNull();
    });
  });

  describe("reassembleCookieChunks", () => {
    it("returns the exact cookie value when unchunked", () => {
      const cookies = [
        { name: "other-cookie", value: "abc" },
        { name: "sb-auth-token", value: "single-token-value" },
      ];
      expect(reassembleCookieChunks(cookies, "sb-auth-token")).toBe(
        "single-token-value",
      );
    });

    it("reassembles chunked cookies in correct numeric order (.0, .1, .2)", () => {
      const cookies = [
        { name: "sb-auth-token.2", value: "-part3" },
        { name: "sb-auth-token.0", value: "part1" },
        { name: "other", value: "unused" },
        { name: "sb-auth-token.1", value: "-part2" },
      ];
      expect(reassembleCookieChunks(cookies, "sb-auth-token")).toBe(
        "part1-part2-part3",
      );
    });

    it("prefers chunked cookies over stale base cookie name", () => {
      const cookies = [
        { name: "sb-auth-token", value: "stale-base-value" },
        { name: "sb-auth-token.0", value: "fresh-chunk-0" },
        { name: "sb-auth-token.1", value: "-fresh-chunk-1" },
      ];
      expect(reassembleCookieChunks(cookies, "sb-auth-token")).toBe(
        "fresh-chunk-0-fresh-chunk-1",
      );
    });

    it("returns null when neither base nor chunks exist", () => {
      const cookies = [{ name: "random", value: "123" }];
      expect(reassembleCookieChunks(cookies, "sb-auth-token")).toBeNull();
    });
  });

  describe("decodeSessionCookieValue", () => {
    it("returns plain text as is when not base64 prefixed", () => {
      expect(decodeSessionCookieValue("raw-plain-text")).toBe("raw-plain-text");
    });

    it("decodes base64- prefixed base64url string", () => {
      const original = JSON.stringify({ access_token: "my-jwt", refresh_token: "ref-123" });
      const b64 = "base64-" + Buffer.from(original, "utf-8").toString("base64url");
      expect(decodeSessionCookieValue(b64)).toBe(original);
    });

    it("returns null for empty string", () => {
      expect(decodeSessionCookieValue("")).toBeNull();
    });
  });
});

  describe("extractAccessTokenFromCookies", () => {
    it("extracts access_token from base64 JSON payload in chunked cookies", () => {
      const session = {
        access_token: "eyJhbGciOiJSUzI1NiJ9.payload.sig",
        refresh_token: "ref",
      };
      const b64 = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
      const half = Math.floor(b64.length / 2);
      const cookies = [
        { name: "sb-test-auth-token.0", value: b64.slice(0, half) },
        { name: "sb-test-auth-token.1", value: b64.slice(half) },
      ];

      const token = extractAccessTokenFromCookies(cookies, "sb-test-auth-token");
      expect(token).toBe("eyJhbGciOiJSUzI1NiJ9.payload.sig");
    });

    it("extracts access_token from unchunked raw JSON cookie", () => {
      const cookies = [
        {
          name: "sb-test-auth-token",
          value: JSON.stringify({ access_token: "jwt-token-123" }),
        },
      ];
      expect(extractAccessTokenFromCookies(cookies, "sb-test-auth-token")).toBe(
        "jwt-token-123",
      );
    });

    it("returns null if access_token field is missing", () => {
      const cookies = [
        {
          name: "sb-test-auth-token",
          value: JSON.stringify({ other_key: "abc" }),
        },
      ];
      expect(extractAccessTokenFromCookies(cookies, "sb-test-auth-token")).toBeNull();
    });
  });

  describe("isJwtExpired", () => {
    it("detects expired tokens", () => {
      const expiredPayload = Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) - 30 }),
      ).toString("base64url");
      const token = `header.${expiredPayload}.sig`;
      expect(isJwtExpired(token)).toBe(true);
    });

    it("detects tokens within expiration buffer (default 10s)", () => {
      const soonExpiringPayload = Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 5 }),
      ).toString("base64url");
      const token = `header.${soonExpiringPayload}.sig`;
      expect(isJwtExpired(token, 10)).toBe(true);
    });

    it("returns false for fresh tokens", () => {
      const freshPayload = Buffer.from(
        JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 }),
      ).toString("base64url");
      const token = `header.${freshPayload}.sig`;
      expect(isJwtExpired(token)).toBe(false);
    });

    it("returns true for unparseable tokens", () => {
      expect(isJwtExpired("not.a.token")).toBe(true);
  describe("mapJwtPayloadToUser", () => {
    it("maps JWT standard claims and Supabase metadata correctly", () => {
      const payload = {
        sub: "user-uuid-123",
        aud: "authenticated",
        role: "authenticated",
        email: "scholar@university.edu",
        phone: "+1234567890",
        iat: 1700000000,
        app_metadata: { provider: "email", roles: ["authenticated"] },
        user_metadata: { name: "Dr. Jane Doe", handle: "janedoe" },
      };

      const user = mapJwtPayloadToUser(payload);
      expect(user).not.toBeNull();
      expect(user?.id).toBe("user-uuid-123");
      expect(user?.aud).toBe("authenticated");
      expect(user?.role).toBe("authenticated");
      expect(user?.email).toBe("scholar@university.edu");
      expect(user?.phone).toBe("+1234567890");
      expect(user?.app_metadata).toEqual(payload.app_metadata);
      expect(user?.user_metadata).toEqual(payload.user_metadata);
      expect(user?.created_at).toBe(new Date(1700000000 * 1000).toISOString());
    });

    it("returns null if sub is missing", () => {
      expect(mapJwtPayloadToUser({ email: "no-sub@domain.com" })).toBeNull();
    });
  });

  describe("local cryptographic verification with jose", () => {
    it("successfully verifies valid token with local JWKS and returns SupabaseUser", async () => {
      const { publicKey, privateKey } = await generateKeyPair("ES256");
      const jwk = await exportJWK(publicKey);
      jwk.kid = "test-kid-1";
      jwk.alg = "ES256";
      jwk.use = "sig";

      const jwks = async () => publicKey;
      const testIssuer = "https://example.supabase.co/auth/v1";

      const token = await new SignJWT({
        sub: "user-456",
        email: "test@domain.com",
        role: "authenticated",
        aud: "authenticated",
        user_metadata: { name: "Test User" },
        app_metadata: { provider: "email" },
      })
        .setProtectedHeader({ alg: "ES256", kid: "test-kid-1" })
        .setIssuedAt()
        .setExpirationTime("2h")
        .setIssuer(testIssuer)
        .sign(privateKey);

      const user = await verifySupabaseTokenLocally(token, {
        supabaseUrl: "https://example.supabase.co",
        jwks,
      });

      expect(user).not.toBeNull();
      expect(user?.id).toBe("user-456");
      expect(user?.email).toBe("test@domain.com");
      expect(user?.user_metadata?.name).toBe("Test User");
    });

    it("rejects token signed with wrong key", async () => {
      const { privateKey } = await generateKeyPair("ES256");
      const anotherKey = await generateKeyPair("ES256");
      const jwks = async () => anotherKey.publicKey;

      const token = await new SignJWT({
        sub: "user-456",
        aud: "authenticated",
      })
        .setProtectedHeader({ alg: "ES256" })
        .setIssuedAt()
        .setExpirationTime("2h")
        .setIssuer("https://example.supabase.co/auth/v1")
        .sign(privateKey);

      const user = await verifySupabaseTokenLocally(token, {
        supabaseUrl: "https://example.supabase.co",
        jwks,
      });

      expect(user).toBeNull();
    });

    it("verifyUserFromCookies integrates chunking and verification seamlessly", async () => {
      const { publicKey, privateKey } = await generateKeyPair("ES256");
      const jwks = async () => publicKey;
      const testIssuer = "https://example.supabase.co/auth/v1";

      const token = await new SignJWT({
        sub: "cookie-user-789",
        email: "cookie@user.org",
        aud: "authenticated",
      })
        .setProtectedHeader({ alg: "ES256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .setIssuer(testIssuer)
        .sign(privateKey);

      const sessionObj = { access_token: token, refresh_token: "ref-abc" };
      const b64 = "base64-" + Buffer.from(JSON.stringify(sessionObj)).toString("base64url");

      const cookies = [
        { name: "sb-myref-auth-token.0", value: b64.slice(0, 50) },
        { name: "sb-myref-auth-token.1", value: b64.slice(50) },
      ];

      const user = await verifyUserFromCookies(cookies, {
        baseName: "sb-myref-auth-token",
        supabaseUrl: "https://example.supabase.co",
        jwks,
      });

      expect(user).not.toBeNull();
      expect(user?.id).toBe("cookie-user-789");
      expect(user?.email).toBe("cookie@user.org");
    });
  });

  describe("getOrCreateRemoteJWKS", () => {
    it("returns cached instance on repeated calls for same URL", () => {
      const url = "https://cache-test.supabase.co";
      const jwks1 = getOrCreateRemoteJWKS(url);
      const jwks2 = getOrCreateRemoteJWKS(url);
      expect(jwks1).toBe(jwks2);
    });

    it("returns null for empty URL", () => {
      expect(getOrCreateRemoteJWKS("")).toBeNull();
    });
  });

    });
  });
