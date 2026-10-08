import { createHash } from 'crypto'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { Duration } from '@upstash/ratelimit'

type RateLimitConfig = {
    namespace: string
    key: string
    limit: number
    window: Duration
    /**
     * What to do when Redis is unavailable (misconfigured, network error,
     * or Upstash quota exhausted).
     *
     * - "open" (default): allow the request, tag outcome `degraded: true`.
     *   Use for READS (search, feed browse, mark-as-read) where blocking
     *   real users is worse than a temporary abuse window.
     * - "closed": deny the request, outcome is
     *   `{ allowed: false, limited: false, degraded: true }` so every
     *   existing `if (!result.allowed)` check blocks automatically.
     *   Use for WRITES (create/edit/delete, votes, follows, messages,
     *   auth, contact) where an unguarded burst costs Supabase pool,
     *   Resend quota, or QStash fan-out.
     *
     * P1-1 / P2 launch item: split fail-open/fail-closed policy.
     */
    onDegraded?: 'open' | 'closed'
}

type RateLimitOutcome =
    | { allowed: true; limited: false; degraded: boolean }
    | { allowed: false; limited: true; degraded: false }
    | { allowed: false; limited: false; degraded: true }
    // NOTE: the third arm is the fail-closed degraded outcome — Redis is
    // down AND the caller asked for onDegraded: 'closed', so the request is
    // denied (not over-limit, hence limited: false).
    // Fail-open (degraded allow) remains the default for reads; callers that
    // must not run unguarded pass onDegraded: 'closed'.
    // Monitor degraded-mode activations in production (warnOnce logs +
    // Sentry breadcrumb via the /api/monitoring/redis-health probe).
    // See: docs/production-launch-checklist.md P1-1.

const limiterCache = new Map<string, Ratelimit | null>()
const warnedNamespaces = new Set<string>()

function warnOnce(namespace: string, error: unknown, mode: 'open' | 'closed') {
    if (warnedNamespaces.has(namespace)) return
    warnedNamespaces.add(namespace)
    const action =
        mode === 'closed'
            ? 'failing CLOSED (requests denied).'
            : 'bypassing limiter (fail-open).'
    console.warn(`[RateLimit:${namespace}] Redis unavailable, ${action}`, error)
}

function getLimiter(
    namespace: string,
    limit: number,
    window: Duration,
    mode: 'open' | 'closed',
): Ratelimit | null {
    const cacheKey = `${namespace}:${limit}:${window}`

    if (limiterCache.has(cacheKey)) {
        return limiterCache.get(cacheKey) ?? null
    }

    try {
        const redis = Redis.fromEnv()
        const limiter = new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(limit, window),
        })
        limiterCache.set(cacheKey, limiter)
        return limiter
    } catch (error) {
        warnOnce(namespace, error, mode)
        limiterCache.set(cacheKey, null)
        return null
    }
}

export function hashRateLimitKey(value: string): string {
    return createHash('sha256').update(value).digest('hex')
}

/**
 * Resolves the real visitor IP behind reverse proxies.
 *
 * With the Cloudflare Orange Cloud proxy enabled, socket-level lookups and
 * 'x-forwarded-for'/'x-real-ip' return Cloudflare Anycast datacenter IPs
 * (e.g. 172.71.x.x, 162.158.x.x). Without this resolution, every visitor
 * collapses onto a few Cloudflare edge keys and Upstash Redis rate limiting
 * throttles unrelated users as a single shared client.
 *
 * Priority: verified Cloudflare client IP -> first entry of the
 * comma-separated forwarding chain -> 'x-real-ip' -> loopback fallback.
 */
export function getClientIp(headers: Headers): string {
    const cfIp = headers.get('cf-connecting-ip')
    if (cfIp) return cfIp.trim()

    const forwardedFor = headers.get('x-forwarded-for')
    if (forwardedFor) {
        const firstIp = forwardedFor.split(',')[0]?.trim()
        if (firstIp) return firstIp
    }

    const realIp = headers.get('x-real-ip')
    if (realIp) return realIp.trim()

    return '127.0.0.1'
}

export function getRequestIpKey(headers: Headers): string {
    return hashRateLimitKey(getClientIp(headers))
}

export function getRequestFingerprint(headers: Headers): string {
    const userAgent = headers.get('user-agent')?.trim() ?? ''
    return hashRateLimitKey(`${getClientIp(headers)}|${userAgent}`)
}

export async function checkRateLimit({
    namespace,
    key,
    limit,
    window,
    onDegraded = 'open',
}: RateLimitConfig): Promise<RateLimitOutcome> {
    const limiter = getLimiter(namespace, limit, window, onDegraded)

    if (!limiter) {
        // Redis client could not even be constructed (missing env). Fail
        // according to caller policy; 'closed' denies so `!allowed` checks
        // block without any caller change.
        warnOnce(namespace, new Error('Redis unavailable (no client)'), onDegraded)
        if (onDegraded === 'closed') {
            return { allowed: false, limited: false, degraded: true }
        }
        return { allowed: true, limited: false, degraded: true }
    }

    try {
        const result = await limiter.limit(`${namespace}:${key}`)
        if (!result.success) {
            return { allowed: false, limited: true, degraded: false }
        }

        return { allowed: true, limited: false, degraded: false }
    } catch (error) {
        warnOnce(namespace, error, onDegraded)
        if (onDegraded === 'closed') {
            return { allowed: false, limited: false, degraded: true }
        }
        return { allowed: true, limited: false, degraded: true }
    }
}

export async function enforceRateLimit(config: RateLimitConfig): Promise<void> {
    // enforce* is only ever called on WRITE paths (create/edit/delete across
    // all 17 content modules), so it defaults to fail-closed: a Redis outage
    // must not silently unlock unlimited writes against the Supabase pool.
    // Read paths use checkRateLimit directly and keep the fail-open default.
    const result = await checkRateLimit({ ...config, onDegraded: 'closed' })
    if (!result.allowed) {
        // Degraded-denied is a transient infra outage, not user abuse — give
        // it a retryable message instead of the throttle copy.
        if (result.degraded) throw new Error(RATE_LIMIT_DEGRADED_ERROR)
        throw new Error(RATE_LIMIT_ERROR)
    }
}

export const RATE_LIMIT_ERROR = 'Too many requests. Please slow down.'
export const RATE_LIMIT_DEGRADED_ERROR =
    'Request protection is temporarily unavailable. Please try again in a moment.'
