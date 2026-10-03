/**
 * Headless CSP sweep across the app's routes.
 *
 * TEMPORARY diagnostic — Phase 1 only, deleted with the report endpoint.
 *
 * Attaches to a running Chrome via the DevTools Protocol (no new dependency —
 * the project has neither Playwright nor Puppeteer, and adding one to audit a
 * header would be the wrong trade), enables Log + Network, visits each route, and
 * reports every `security.cspViolation` / `Log.entryAdded` event.
 *
 * Dev-mode `eval` from the Next.js HMR runtime is filtered out, and reported
 * separately, because it is known not to reach production.
 *
 * SCOPE LIMIT — read before trusting a clean run:
 *   This browser has NO session cookie, so it exercises ANONYMOUS loads only.
 *   Anything gated behind sign-in is NOT covered, most notably Supabase Realtime:
 *   the `wss://` connect-src violation only fires once the Sidebar opens a
 *   WebSocket for a logged-in user. That one was found from the dev-server log of
 *   a real session, not from here. To cover it, sign in via CDP first (set the
 *   Supabase auth cookie on the target) before sweeping.
 *
 *   A missing header also looks identical to a clean page, so the run should be
 *   paired with `curl -sI` to confirm the header is actually being served.
 *
 * Usage:  node scripts/csp-sweep.mjs [baseUrl]
 */
const BASE = process.argv[2] ?? "http://localhost:3000";
const CDP = "http://localhost:9222";

const ROUTES = [
  "/",
  "/feed",
  "/scholars",
  "/notifications",
  "/login",
  "/about",
  "/privacy",
  "/terms",
  "/contact",
  "/careers",
  "/learn",
  "/jobs",
  "/messages",
  "/search",
  "/publications",
  "/journals",
  "/events",
  "/courses",
  "/results",
  "/help",
  "/blog",
  "/settings",
  "/request-institution",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newTarget() {
  const res = await fetch(`${CDP}/json/new?about:blank`, { method: "PUT" });
  return res.json();
}

async function closeTarget(id) {
  await fetch(`${CDP}/json/close/${id}`).catch(() => {});
}

/** Minimal CDP websocket client over the built-in WebSocket (Node 22+). */
function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = [];

  const ready = new Promise((resolve, reject) => {
    ws.onopen = () => resolve();
    ws.onerror = (e) => reject(new Error(`ws error: ${e?.message ?? "unknown"}`));
  });

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) {
        reject(new Error(JSON.stringify(msg.error)));
      } else {
        resolve(msg.result);
      }
    } else if (msg.method) {
      for (const fn of listeners) fn(msg.method, msg.params);
    }
  };

  return {
    ready,
    send: (method, params = {}, sessionId) =>
      new Promise((resolve, reject) => {
        const id = nextId++;
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params, sessionId }));
      }),
    on: (fn) => listeners.push(fn),
    close: () => ws.close(),
  };
}

async function sweep(route) {
  const target = await newTarget();
  const client = connect(target.webSocketDebuggerUrl);
  await client.ready;

  const violations = [];
  const errors = [];

  client.on((method, params) => {
    if (method === "Log.entryAdded") {
      const e = params.entry;
      if (e.source === "security" || /Content Security Policy/i.test(e.text ?? "")) {
        violations.push({ kind: "log", level: e.level, text: e.text, url: e.url });
      }
    }
    if (method === "Audits.issueAdded") {
      const issue = params.issue;
      if (issue.code === "CSPViolation") {
        violations.push({
          kind: "audit",
          text: `${issue.code}`,
          details: JSON.stringify(issue.details ?? {}).slice(0, 400),
        });
      }
    }
    // Uncaught exceptions are the signal that a blocked script actually broke
    // something. Under enforcement these are what a "clean" violation list hides.
    if (method === "Runtime.exceptionThrown") {
      const d = params.exceptionDetails;
      errors.push(
        `uncaught: ${d.exception?.description ?? d.text ?? "unknown"}`.slice(0, 300),
      );
    }
    if (method === "Runtime.consoleAPICalled" && params.type === "error") {
      const text = (params.args ?? [])
        .map((a) => a.value ?? a.description ?? "")
        .join(" ")
        .trim();
      if (text) errors.push(`console.error: ${text}`.slice(0, 300));
    }
  });

  await client.send("Log.enable");
  await client.send("Network.enable");
  await client.send("Runtime.enable");
  try {
    await client.send("Audits.enable");
  } catch {
    /* Audits domain is optional. */
  }

  await client.send("Page.enable");
  await client.send("Page.navigate", { url: `${BASE}${route}` });
  // Give the page time to hydrate, fire CSP reports, and open any websocket.
  await sleep(4500);

  // Did React actually take over the server-rendered markup? If a bootstrap
  // script were blocked, the HTML would still render and the violation list
  // could still be empty, so this is checked directly rather than inferred.
  let hydrated = false;
  try {
    const res = await client.send("Runtime.evaluate", {
      expression: `(() => {
        const root = document.getElementById('__next') || document.body;
        const keys = Object.keys(root).filter(k => k.startsWith('__react'));
        return keys.length > 0 ? 'true' : 'false';
      })()`,
      returnByValue: true,
    });
    hydrated = res.result?.value === "true" || res.result?.value === true;
  } catch {
    hydrated = false;
  }

  client.close();
  await closeTarget(target.id);
  return { violations, errors, hydrated };
}

const all = [];
const brokenPages = [];

for (const route of ROUTES) {
  let violations = [];
  let errors = [];
  let hydrated = false;
  try {
    ({ violations, errors, hydrated } = await sweep(route));
  } catch (err) {
    violations = [{ kind: "error", text: String(err) }];
  }

  const devEval = violations.filter((v) => /blocked[^\n]*eval|\beval\b/i.test(v.text ?? ""));
  const real = violations.filter((v) => !devEval.includes(v));

  // A clean violation list is NOT proof the page works. Under an ENFORCING
  // policy, a blocked script can leave a rendered-but-dead shell with zero
  // policy violations, so hydration is asserted explicitly.
  const dead = errors.length > 0 || !hydrated;
  const status = dead ? "BROKEN" : real.length === 0 ? "OK" : `${real.length} ISSUE(S)`;

  console.log(`\n=== ${route} — ${status}`);
  for (const e of errors) console.log(`   [js-error] ${e}`);
  for (const v of real) {
    console.log(`   [${v.kind}/${v.level ?? "-"}] ${v.text}`);
    if (v.url) console.log(`      url: ${v.url}`);
  }
  if (devEval.length) console.log(`   (${devEval.length} dev-only eval report(s) filtered)`);
  if (dead) brokenPages.push(route);
  all.push({ route, real, devEval: devEval.length });
}

console.log("\n================ SUMMARY ================");
let clean = 0;
for (const r of all) {
  if (r.real.length === 0) {
    clean++;
    console.log(`  OK    ${r.route}`);
  } else {
    console.log(`  ISSUE ${r.route}  -> ${r.real[0].text?.slice(0, 160)}`);
  }
}
console.log(`\n${clean}/${all.length} routes with no non-dev CSP violations.`);
if (brokenPages.length) {
  console.log(`\n!! ${brokenPages.length} route(s) did not hydrate cleanly:`);
  for (const r of brokenPages) console.log(`   ${r}`);
  process.exitCode = 1;
} else {
  console.log("All routes hydrated with no JS errors.");
}