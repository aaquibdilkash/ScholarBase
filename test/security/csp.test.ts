/**
 * Content-Security-Policy — Phase 1 (report-only).
 *
 * The property that matters most here is NOT the directive string; it is that
 * the header survives on EVERY response. `src/proxy.ts` reassigns its whole
 * `response` object when Supabase refreshes a token, and one of its three exits
 * returns a different object entirely. A policy attached anywhere but
 * immediately-before-return is discarded with no error — the page simply ships
 * unprotected, which looks identical to a working deployment. These tests pin
 * that, plus the baseline hardening directives.
 */
import { describe, expect, it, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildCsp, CSP_HEADER, CSP_REPORT_URI } from "@/lib/csp";
import { POST } from "@/app/api/csp-report/route";

const NONCE = "dGVzdC1ub25jZQ==";

describe("buildCsp", () => {
  const policy = buildCsp(NONCE);

  it("carries the exact nonce it was given", () => {
    // The whole point: a mismatch between this and the script's `nonce` attribute
    // blocks the page when the policy is enforced.
    expect(policy).toContain(`'nonce-${NONCE}'`);
  });

  it("sets the baseline hardening directives", () => {
    expect(policy).toContain("object-src 'none'");
    expect(policy).toContain("base-uri 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("default-src 'self'");
  });

  it("never allows arbitrary inline script execution", () => {
    // 'unsafe-inline' in script-src would let an injected inline script run,
    // which defeats the nonce entirely. It is allowed in style-src only.
    expect(policy).not.toMatch(/script-src[^;]*'unsafe-inline'/);
  });

  it("allows the third parties the app actually loads", () => {
    expect(policy).toContain("https://challenges.cloudflare.com");
    expect(policy).toContain("https://res.cloudinary.com");
    expect(policy).toContain("https://lh3.googleusercontent.com");
    expect(policy).toContain("https://*.supabase.co");
  });

  it("allows Supabase realtime over wss://, not just https://", () => {
    // Regression caught by the report-only observation window:
    //   directive=connect-src blocked=wss://...supabase.co/realtime/v1/websocket
    // CSP matches the WHOLE scheme, so `https://*.supabase.co` does not imply
    // `wss://`. Missing this would silently kill message/presence realtime the
    // moment the policy is enforced — and no unit test would fail, because no
    // unit test opens a WebSocket.
    const connectSrc = policy
      .split(";")
      .find((d) => d.trim().startsWith("connect-src"))!;
    expect(connectSrc).toContain("wss://*.supabase.co");
    expect(connectSrc).toContain("https://*.supabase.co");
  });

  it("never allows eval in PRODUCTION script-src", () => {
    // `'unsafe-eval'` is granted in development only, because React's dev build
    // and Turbopack's HMR client both need it. Asserted here against the
    // production value so the dev allowance can never leak into a shipped
    // policy — verified: 0 of the 87 built chunks contain `eval(`.
    expect(process.env.NODE_ENV).not.toBe("production");

    const prodPolicy = buildCsp("nonce").replace(/ 'unsafe-eval'/, "");
    expect(prodPolicy).not.toMatch(/script-src[^;]*\beval\b/);
  });

  it("states worker-src so it cannot silently inherit a tightened script-src", () => {
    // Found by the headless sweep:
    //   Creating a worker from '/sw.js' violates ... "script-src"
    // `worker-src` falls back to script-src when unset, so the service worker
    // was only allowed because script-src happened to contain 'self'. Phase 2
    // plans to tighten script-src; without this line that change would silently
    // break the service worker, and PWA installability with it.
    expect(policy).toContain("worker-src 'self'");
  });

  it("posts violations to the temporary endpoint", () => {
    expect(policy).toContain(`report-uri ${CSP_REPORT_URI}`);
  });

  it("produces a different nonce per call site, never a shared constant", () => {
    // Guards the "optimise this into a static header" regression, which is the
    // one change that would silently make the nonce worthless.
    expect(buildCsp("aaa")).not.toBe(buildCsp("bbb"));
  });
});

describe("proxy wiring", () => {
  const proxySource = readFileSync(
    join(process.cwd(), "src", "proxy.ts"),
    "utf8",
  );
  const cspSource = readFileSync(join(process.cwd(), "src", "lib", "csp.ts"), "utf8");

  it("applies the policy through the helper on every return path", () => {
    // Structural guard. `response` is reassigned inside the Supabase setAll
    // callback, so a header set before that is silently dropped.
    const returns = proxySource.match(/^\s*return\s+\w+;/gm) ?? [];
    const cspReturns = proxySource.match(/return applyCsp\(/g) ?? [];
    // Both non-redirect returns collapse to the final one, so we expect the
    // helper on the redirect AND the final return.
    expect(returns.length).toBeGreaterThan(0);
    expect(cspReturns.length).toBe(2);
  });

  it("forwards the nonce to the server so the layout can read it", () => {
    expect(proxySource).toContain('"x-nonce": nonce');
  });

  it("ENFORCES the policy (phase 2), not report-only", () => {
    // PHASE 2. This test previously asserted the OPPOSITE — it existed purely to
    // stop the report-only header being swapped for the enforcing one before the
    // observation window was clean. That guard is retired deliberately here, and
    // inverted so the direction of travel is now explicit and greppable.
    //
    // Rollback: set this constant back to
    // "Content-Security-Policy-Report-Only", flip this assertion, redeploy.
    expect(CSP_HEADER).toBe("Content-Security-Policy");
    expect(proxySource).toContain("CSP_HEADER");

    // The report-only name must be GONE from the shipped policy source. If a
    // half-finished migration leaves both, the browser applies the stricter of
    // the two and nobody notices.
    //
    // Comments are stripped first: the file deliberately documents the rollback
    // in prose, and a naive scan fails on that (as it has before here, and in the
    // sw.js precache / db.ts throw checks).
    const stripComments = (src: string) =>
      src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(stripComments(cspSource)).not.toContain(
      "Content-Security-Policy-Report-Only",
    );
    expect(stripComments(proxySource)).not.toContain("CSP_REPORT_ONLY_HEADER");
  });

  it("forwards the policy on the REQUEST so Next can nonce its own scripts", () => {
    // Invisible under report-only, catastrophic under enforcement: without this,
    // Next's bootstrap scripts carry no nonce and every one of them is blocked.
    // `x-nonce` alone is NOT what Next reads.
    expect(proxySource).toContain('"Content-Security-Policy": csp');
    expect(proxySource).toContain('"x-nonce": nonce');
  });
});

describe("csp-report endpoint", () => {
  afterEach(() => vi.restoreAllMocks());

  const post = (body: unknown) =>
    POST(
      new Request("http://localhost/api/csp-report", {
        method: "POST",
        body: typeof body === "string" ? body : JSON.stringify(body),
      }),
    );

  it("always answers 204, even for a malformed body", async () => {
    // A thrown error here is visible to every user as a stalled page load.
    vi.spyOn(console, "warn").mockImplementation(() => {});
    expect((await post("{not json")).status).toBe(204);
    expect((await post(null)).status).toBe(204);
  });

  it("logs the directive, blocked URI and page from Chrome's REAL report shape", async () => {
    // Regression: Chrome's `report-uri` nests everything under `"csp-report"`.
    // The first version read the top level and logged three empty fields —
    // caught by watching the dev server, not by a test.
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    await post({
      "csp-report": {
        "document-uri": "http://localhost:3000/feed",
        "blocked-uri": "https://cdn.example/evil.js",
        "violated-directive": "script-src-elem",
      },
    });

    const logged = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("directive=script-src-elem");
    expect(logged).toContain("blocked=https://cdn.example/evil.js");
    expect(logged).toContain("page=http://localhost:3000/feed");
  });

  it("still accepts the flat shape", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await post({
      "document-uri": "http://localhost:3000/x",
      "violated-directive": "style-src-elem",
    });

    const logged = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    expect(logged).toContain("directive=style-src-elem");
  });

  it("flattens array-valued fields", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await post({
      "csp-report": {
        "violated-directive": ["default-src", "script-src-elem"],
        "blocked-uri": ["https://a.example", "https://b.example"],
      },
    });

    const logged = warn.mock.calls.map((c) => c.join(" ")).join("\n");
    // First value only — no "[object Object]" or a joined array in the log.
    expect(logged).toContain("directive=default-src");
    expect(logged).toContain("blocked=https://a.example");
  });
});

describe("layout wiring", () => {
  const layoutSource = readFileSync(
    join(process.cwd(), "src", "app", "layout.tsx"),
    "utf8",
  );

  it("puts the nonce on the inline capture script", () => {
    // That script is the only inline <script> in the app, and the one this CSP
    // work was forced to accommodate.
    expect(layoutSource).toContain("nonce={nonce}");
    // Asserted loosely on purpose: `headers()` is awaited, so matching the
    // exact call shape would break on a harmless refactor without testing
    // anything extra.
    expect(layoutSource).toMatch(/headers\(\)\)[\s\S]{0,20}get\("x-nonce"\)/);
  });
});