#!/usr/bin/env node

import { setTimeout as delay } from "node:timers/promises";

const baseUrl = (process.env.BASE_URL || "http://localhost:3000").replace(
  /\/+$/,
  "",
);
const initialConcurrency = Number(process.env.INITIAL_CONCURRENCY || 10);
const maxConcurrency = Number(process.env.MAX_CONCURRENCY || 80);
const rampSeconds = Number(process.env.RAMP_SECONDS || 20);
const steadySeconds = Number(process.env.STEADY_SECONDS || 45);
const burstSeconds = Number(process.env.BURST_SECONDS || 20);
const cooldownSeconds = Number(process.env.COOLDOWN_SECONDS || 10);
const requestTimeoutMs = Number(process.env.REQUEST_TIMEOUT_MS || 5000);
const mode = (process.env.MODE || "mixed").toLowerCase();
const quiet = process.env.QUIET === "1";
const authCookie = process.env.AUTH_COOKIE || "";

const getRoutes = [
  "/",
  "/feed",
  "/scholars",
  "/publications",
  "/grants",
  "/careers",
  "/events",
  "/results",
  "/blog",
  "/learn",
  "/vacancies",
  "/login",
  "/terms",
  "/privacy",
];

const postRoutes = [
  {
    method: "POST",
    path: "/contact",
    form: {
      name: "Load Test",
      email: "loadtest@example.com",
      subject: "Free-tier capacity test",
      message: "This is a staged local production load test trigger.",
    },
  },
  { method: "GET", path: "/api/logo" },
  { method: "GET", path: "/api/badge" },
];

const phaseDefinitions = {
  readHeavy: {
    ratio: { get: 0.9, post: 0.1 },
  },
  mixed: {
    ratio: { get: 0.75, post: 0.25 },
  },
  writeHeavy: {
    ratio: { get: 0.5, post: 0.5 },
  },
};

const metrics = {
  total: 0,
  ok: 0,
  failed: 0,
  timeouts: 0,
  statusCodes: new Map(),
  latency: [],
  errors: [],
};

function getPhaseConfig() {
  return phaseDefinitions[mode] || phaseDefinitions.mixed;
}

function randomFrom(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function makeRequestBody(route) {
  if (!route.form) return null;
  const body = new URLSearchParams();
  for (const [key, value] of Object.entries(route.form)) {
    body.append(key, value);
  }
  return body;
}

function buildUrl(path) {
  return `${baseUrl}${path}`;
}

function recordStatus(code) {
  metrics.statusCodes.set(code, (metrics.statusCodes.get(code) || 0) + 1);
}

function recordLatency(ms) {
  metrics.latency.push(ms);
}

function recordError(message) {
  if (metrics.errors.length < 25) {
    metrics.errors.push(message);
  }
}

async function doRequest(kind, path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), requestTimeoutMs);
  const startedAt = Date.now();

  try {
    const headers = {
      "x-free-tier-load-test": "1",
      "user-agent": "scholarbase-free-tier-load-test/1.1",
      ...(authCookie ? { cookie: authCookie } : {}),
      ...(options.headers || {}),
    };

    const res = await fetch(buildUrl(path), {
      ...options,
      method: options.method || "GET",
      headers,
      redirect: "manual",
      signal: controller.signal,
    });

    const latency = Date.now() - startedAt;
    recordLatency(latency);
    metrics.total += 1;
    recordStatus(res.status);

    if (res.ok) {
      metrics.ok += 1;
      return { ok: true, status: res.status, latency, url: path };
    }

    metrics.failed += 1;
    recordError(`${res.status} ${path}`);
    return { ok: false, status: res.status, latency, url: path };
  } catch (error) {
    const latency = Date.now() - startedAt;
    recordLatency(latency);
    metrics.total += 1;
    metrics.failed += 1;
    metrics.timeouts += 1;
    recordError(`${error.name}: ${error.message} @ ${path}`);
    return { ok: false, timeout: true, latency, url: path };
  } finally {
    clearTimeout(timer);
  }
}

function pickRoute() {
  const config = getPhaseConfig();
  const roll = Math.random();
  if (roll < config.ratio.get) {
    return { kind: "get", path: randomFrom(getRoutes) };
  }

  const route = randomFrom(postRoutes);
  return {
    kind: "post",
    path: route.path,
    method: route.method || "POST",
    body: makeRequestBody(route),
    headers:
      route.method === "POST"
        ? { "content-type": "application/x-www-form-urlencoded" }
        : {},
  };
}

async function runPhase(name, concurrency, durationMs) {
  const start = Date.now();
  const phaseMetrics = {
    phase: name,
    total: 0,
    ok: 0,
    failed: 0,
    timeouts: 0,
    latency: [],
    statusCodes: new Map(),
  };

  const workers = Array.from(
    { length: concurrency },
    async (_, workerIndex) => {
      const workerEnd = Date.now() + durationMs;
      let count = 0;

      while (Date.now() < workerEnd) {
        const route = pickRoute();
        const result = await doRequest(route.kind, route.path, {
          method: route.method || "GET",
          body: route.body || undefined,
          headers: route.headers || {},
        });

        count += 1;
        phaseMetrics.total += 1;
        phaseMetrics.ok += result.ok ? 1 : 0;
        phaseMetrics.failed += result.ok ? 0 : 1;
        phaseMetrics.timeouts += result.timeout ? 1 : 0;
        phaseMetrics.latency.push(result.latency ?? 0);

        if (result.status) {
          phaseMetrics.statusCodes.set(
            result.status,
            (phaseMetrics.statusCodes.get(result.status) || 0) + 1,
          );
        }

        if (!quiet && count % 5 === 0) {
          const elapsed = Date.now() - start;
          console.log(
            `[${name}] worker ${workerIndex + 1}: ${count} requests, elapsed=${elapsed}ms`,
          );
        }
      }
    },
  );

  await Promise.allSettled(workers);

  const avgLatency = phaseMetrics.latency.length
    ? Math.round(
        phaseMetrics.latency.reduce((sum, value) => sum + value, 0) /
          phaseMetrics.latency.length,
      )
    : 0;
  const sorted = [...phaseMetrics.latency].sort((a, b) => a - b);
  const p95 = sorted.length
    ? sorted[Math.max(0, Math.floor(sorted.length * 0.95) - 1)] || 0
    : 0;
  const max = sorted.length ? sorted[sorted.length - 1] : 0;

  console.log(`\n=== ${name.toUpperCase()} SUMMARY ===`);
  console.log({
    concurrency,
    durationMs,
    total: phaseMetrics.total,
    ok: phaseMetrics.ok,
    failed: phaseMetrics.failed,
    timeouts: phaseMetrics.timeouts,
    avgLatency: avgLatency,
    p95,
    max,
  });
  if (phaseMetrics.statusCodes.size > 0) {
    console.log(
      "statusCodes",
      Object.fromEntries([...phaseMetrics.statusCodes.entries()]),
    );
  }

  return { phaseMetrics, avgLatency, p95, max };
}

async function main() {
  console.log("=== ScholarBase Free-Tier Production Capacity Test ===");
  console.log({
    baseUrl,
    mode,
    initialConcurrency,
    maxConcurrency,
    rampSeconds,
    steadySeconds,
    burstSeconds,
    cooldownSeconds,
    requestTimeoutMs,
  });
  console.log(
    "This is a local production-like stress test for app capacity, not a real cloud SLA claim.",
  );

  const phases = [
    {
      name: "warmup",
      concurrency: initialConcurrency,
      durationMs: rampSeconds * 1000,
    },
    {
      name: "steady",
      concurrency: Math.max(initialConcurrency, 20),
      durationMs: steadySeconds * 1000,
    },
    {
      name: "burst",
      concurrency: maxConcurrency,
      durationMs: burstSeconds * 1000,
    },
    {
      name: "cooldown",
      concurrency: Math.max(5, Math.floor(maxConcurrency / 2)),
      durationMs: cooldownSeconds * 1000,
    },
  ];

  const summaries = [];
  for (const phase of phases) {
    const summary = await runPhase(
      phase.name,
      phase.concurrency,
      phase.durationMs,
    );
    summaries.push(summary);
    await delay(250);
  }

  const totalRequests = metrics.total;
  const failRate = totalRequests ? (metrics.failed / totalRequests) * 100 : 0;
  const avgLatency = metrics.latency.length
    ? Math.round(
        metrics.latency.reduce((sum, value) => sum + value, 0) /
          metrics.latency.length,
      )
    : 0;
  const sorted = [...metrics.latency].sort((a, b) => a - b);
  const p95 = sorted.length
    ? sorted[Math.max(0, Math.floor(sorted.length * 0.95) - 1)] || 0
    : 0;
  const maxLatency = sorted.length ? sorted[sorted.length - 1] : 0;

  console.log("\n=== FINAL CAPACITY REPORT ===");
  console.log({
    totalRequests,
    ok: metrics.ok,
    failed: metrics.failed,
    timeouts: metrics.timeouts,
    avgLatency,
    p95,
    maxLatency,
    failRate: `${failRate.toFixed(2)}%`,
  });
  console.log(
    "statusCodes",
    Object.fromEntries([...metrics.statusCodes.entries()]),
  );

  if (metrics.errors.length > 0) {
    console.log("\n=== Error Samples ===");
    console.log(metrics.errors.slice(0, 20).join("\n"));
  }

  const risk = failRate > 5 || p95 > 3500 || avgLatency > 1800;

  console.log("\n=== Free-tier launch read ===");
  console.log(
    risk
      ? "RISK: this app is likely not production-safe on a free-tier stack under these traffic conditions."
      : "OK: this app stayed within a safe local capacity envelope under the test profile.",
  );

  process.exitCode = risk ? 1 : 0;
}

main().catch((error) => {
  console.error("Production capacity test crashed unexpectedly:", error);
  process.exit(1);
});
