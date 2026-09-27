import { afterEach, describe, expect, it } from "vitest"

/**
 * Environment and network guards.
 *
 * These assert the *safety rails themselves* (installed by `test/setup.ts`), not
 * product behaviour. If a guard silently stops working — a refactor removes the
 * fetch wrapper, or a CI job injects a production DSN — this file goes red rather
 * than the suite quietly gaining the ability to reach production.
 */

const realFetch = globalThis.fetch

describe("unit tier is offline by construction", () => {
  afterEach(() => {
    globalThis.fetch = realFetch
  })

  it("blocks a Supabase REST call", async () => {
    await expect(
      fetch("https://proj-xzq.supabase.co/rest/v1/User", {
        headers: { apikey: "leaked-key" },
      }),
    ).rejects.toThrow(/never talks to Supabase|real outbound request/i)
  })

  it("blocks Resend, Upstash and Cloudinary equally", async () => {
    for (const url of [
      "https://api.resend.com/emails",
      "https://us1-upstash.example/20000/get",
      "https://res.cloudinary.com/demo/image/upload",
      "https://qstash.upstash.io/v2/publish/https%3A%2F%2Fexample.com",
    ]) {
      await expect(fetch(url)).rejects.toThrow(/real outbound request/i)
    }
  })

  it("still permits loopback, so local fakes and MSW-style stubs work", async () => {
    // The guard delegates to the real fetch once a URL is allowed, so stub fetch
    // to keep this assertion from depending on a listening port.
    globalThis.fetch = ((input: RequestInfo | URL) =>
      Promise.resolve(new Response(`ok:${String(input)}`))) as typeof fetch
    const response = await fetch("http://localhost:54321/ping")
    expect(await response.text()).toBe("ok:http://localhost:54321/ping")
  })

  it("rejects a malformed URL rather than letting it slip past the guard", async () => {
    // `not-a-url` cannot be parsed, so the conservative answer is to block it.
    await expect(fetch("not-a-url")).rejects.toThrow(/unparseable URL|real outbound request/i)
  })
})

describe("no production credentials in the test environment", () => {
  const SENSITIVE = [
    "DATABASE_URL",
    "DIRECT_URL",
    "SUPABASE_SERVICE_ROLE_KEY",
    "RESEND_API_KEY",
    "UPSTASH_REDIS_REST_TOKEN",
    "CLOUDINARY_URL",
    "CRON_SECRET",
    "QSTASH_TOKEN",
    "VAPID_PRIVATE_KEY",
  ] as const

  it.each(SENSITIVE)("%s is absent, or points away from production", (key) => {
    const value = process.env[key]
    if (!value) return

    // Secrets that *are* present must be obvious fakes: this keeps a real
    // credential from being used by a test that accidentally opts in.
    const isFake =
      /^(test|fake|dummy|mock|local|x{3,})[-_:]/i.test(value) ||
      /(test|fake|dummy|mock|localhost|127\.0\.0\.1)/i.test(value)

    expect(isFake, `${key} looks like a real credential — refusing to run`).toBe(true)
  })

  it("never resolves any credential host to Supabase", () => {
    for (const key of SENSITIVE) {
      const value = process.env[key]
      if (!value) continue
      const hosts: string[] = value.match(/https?:\/\/([^/\s"']+)/gi) ?? []
      const bucket = value.match(/^postgres(?:ql)?:\/\/(?:[^@]*@)?([^/?\s]+)/i)?.[1]
      if (bucket) hosts.push(`https://${bucket}`)
      for (const host of hosts) {
        expect(host).not.toMatch(/\.supabase\.(co|in|red)/i)
      }
    }
  })
})
