/**
 * M7 of the launch-readiness audit — error monitoring.
 *
 * The failure mode this guards is two-sided:
 *  1. Shipping an observability SDK that never actually initialises (missing
 *     DSN handling) means production errors keep surfacing as user complaints
 *     while the dashboard stays green.
 *  2. Initialising UNCONDITIONALLY would send dev/CI noise — or worse, block
 *     builds — on environments with no project to report to.
 *
 * So the wiring is asserted behaviourally against the real modules with the
 * SDK mocked: init must be a no-op without a DSN, must fire with one, the
 * server config must only load in the nodejs runtime, and `onRequestError`
 * must forward failures (Server Actions, routes, renders) to Sentry. The CSP
 * allowlist is checked too — an ingest endpoint blocked by connect-src fails
 * silently in production while every test stays green.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const initMock = vi.fn();
const captureRequestErrorMock = vi.fn();

vi.mock("@sentry/nextjs", () => ({
  init: initMock,
  captureRequestError: captureRequestErrorMock,
}));

const DSN = "https://public@o123.ingest.us.sentry.io/456";
const KEYS = ["NEXT_PUBLIC_SENTRY_DSN", "NEXT_RUNTIME"] as const;
const saved: Partial<Record<(typeof KEYS)[number], string | undefined>> = {};

function setEnv(key: (typeof KEYS)[number], value: string | undefined) {
  if (!(key in saved)) saved[key] = process.env[key];
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

beforeEach(() => {
  vi.resetModules();
  initMock.mockClear();
  captureRequestErrorMock.mockClear();
});

afterEach(() => {
  for (const key of KEYS) {
    if (key in saved) {
      const value = saved[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
      delete saved[key];
    }
  }
});

describe("Sentry wiring", () => {
  it("the client bootstrap does NOT initialise without a DSN", async () => {
    setEnv("NEXT_PUBLIC_SENTRY_DSN", undefined);
    await import("@/instrumentation-client");
    expect(initMock).not.toHaveBeenCalled();
  });

  it("the client bootstrap initialises with the configured DSN", async () => {
    setEnv("NEXT_PUBLIC_SENTRY_DSN", DSN);
    await import("@/instrumentation-client");
    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: DSN }),
    );
  });

  it("both inits run ERRORS-ONLY: zero transaction sampling", async () => {
    // The Developer quota has ~1k errors and ~50k spans. A healthy launch
    // produces far fewer errors than that, while 10%-sampled transactions
    // would burn the span allowance under real traffic. Every sampled crash
    // must stay a sampled-in ERROR, and spans must never be created.
    setEnv("NEXT_PUBLIC_SENTRY_DSN", DSN);
    setEnv("NEXT_RUNTIME", "nodejs");

    await import("@/instrumentation-client");
    const clientMod = await import("@/instrumentation");
    await clientMod.register(); // loads src/sentry.server.config.ts

    const inits = initMock.mock.calls;
    expect(inits.length).toBeGreaterThanOrEqual(2);
    for (const [options] of inits) {
      expect(options).toMatchObject({ tracesSampleRate: 0 });
    }
  });

  it("the client init drops the classic browser-noise errors", async () => {
    // Extensions, ad blockers and layout thrash fire window.onerror with
    // these; each forwarded one is a slot a real crash does not get.
    setEnv("NEXT_PUBLIC_SENTRY_DSN", DSN);
    await import("@/instrumentation-client");

    // init takes a single options argument; the entry is [options], not [dsn, options].
    const [clientOptions] = initMock.mock.calls.find(
      ([options]) => options && "ignoreErrors" in options,
    ) ?? [];
    expect(clientOptions?.ignoreErrors).toEqual(
      expect.arrayContaining([
        "ResizeObserver loop completed with undelivered notifications",
        "ResizeObserver loop limit exceeded",
        "Network request failed",
        "Load failed",
      ]),
    );
  });

  it("register() loads the server config in the nodejs runtime", async () => {
    setEnv("NEXT_PUBLIC_SENTRY_DSN", DSN);
    setEnv("NEXT_RUNTIME", "nodejs");
    const mod = await import("@/instrumentation");
    await mod.register();
    expect(initMock).toHaveBeenCalledWith(
      expect.objectContaining({ dsn: DSN }),
    );
  });

  it("register() stays inert on the edge runtime (deliberate scope cut)", async () => {
    setEnv("NEXT_PUBLIC_SENTRY_DSN", DSN);
    setEnv("NEXT_RUNTIME", "edge");
    const mod = await import("@/instrumentation");
    await mod.register();
    expect(initMock).not.toHaveBeenCalled();
  });

  it("register() loads nothing when no DSN is configured", async () => {
    setEnv("NEXT_PUBLIC_SENTRY_DSN", undefined);
    setEnv("NEXT_RUNTIME", "nodejs");
    const mod = await import("@/instrumentation");
    await mod.register();
    // The server config module still imports, but its init is DSN-gated.
    expect(initMock).not.toHaveBeenCalled();
  });

  it("onRequestError forwards failed requests/actions to Sentry", async () => {
    const mod = await import("@/instrumentation");
    const error = new Error("action blew up");
    const request = { path: "/feed", method: "POST", headers: {} };
    const context = {
      routerKind: "App Router",
      routePath: "/feed",
      routeType: "action",
    } as never;

    mod.onRequestError(error, request, context);

    expect(captureRequestErrorMock).toHaveBeenCalledWith(
      error,
      request,
      context,
    );
  });

  it("the CSP allows the Sentry ingest endpoints (silent-drop guard)", () => {
    // connect-src enforcement happens at runtime where no test runs: if the
    // host is missing, events are blocked by the browser and the dashboard
    // stays silently empty. That already happened once: the org lives in the
    // EU region (`o4512215083122688.ingest.de.sentry.io`), which neither of
    // the original two wildcards covered - while this very test stayed green.
    // So the assertion is region-aware: every known ingest region that this
    // codebase might deploy against must be listed, and the DSN shape the
    // project actually uses must match one of them.
    const csp = readFileSync(join(process.cwd(), "src", "lib", "csp.ts"), "utf8");
    // NOTE: this scans csp.ts SOURCE, where directives are separate template
    // literals, not `;`-joined (that happens in buildCsp at runtime). Anchor
    // on the backtick-quoted directive specifically: a naive "connect-src"
    // match hits an explanatory comment first (which is exactly what the
    // previous version of this test did).
    const connectSrc = csp.match(/`connect-src[^`]+/)?.[0] ?? "";
    expect(connectSrc.length).toBeGreaterThan(0);
    for (const region of ["ingest.sentry.io", "ingest.us.sentry.io", "ingest.de.sentry.io"]) {
      expect(connectSrc).toContain(`https://*.${region}`);
    }

    // The DSN shape Sentry issues per region: o<orgId>.ingest[.<region>].sentry.io.
    // Extract each region wildcard from the policy and prove the project's
    // own DSN host pattern would be allowed by one of them.
    const allowedRegions = [...connectSrc.matchAll(/ingest(?:\.([a-z]{2}))?\.sentry\.io/g)].map(
      (m) => m[1] ?? "",
    );
    const projectDsnRegion = "de"; // from NEXT_PUBLIC_SENTRY_DSN: o4512215083122688.ingest.de.sentry.io
    expect(allowedRegions).toContain(projectDsnRegion);
  });
});
