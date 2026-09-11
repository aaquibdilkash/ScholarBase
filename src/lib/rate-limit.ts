import { createHash } from 'crypto'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import type { Duration } from '@upstash/ratelimit'

type RateLimitConfig = {
    namespace: string
    key: string
    limit: number
    window: Duration
}

type RateLimitOutcome =
    | { allowed: true; limited: false; degraded: boolean }
    | { allowed: false; limited: true; degraded: false }

const limiterCache = new Map<string, Ratelimit | null>()
const warnedNamespaces = new Set<string>()

function warnOnce(namespace: string, error: unknown) {
    if (warnedNamespaces.has(namespace)) return
    warnedNamespaces.add(namespace)
    console.warn(
        `[RateLimit:${namespace}] Redis unavailable, bypassing limiter.`,
        error,
    )
}

function getLimiter(namespace: string, limit: number, window: Duration): Ratelimit | null {
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
        warnOnce(namespace, error)
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
}: RateLimitConfig): Promise<RateLimitOutcome> {
    const limiter = getLimiter(namespace, limit, window)

    if (!limiter) {
        return { allowed: true, limited: false, degraded: true }
    }

    try {
        const result = await limiter.limit(`${namespace}:${key}`)
        if (!result.success) {
            return { allowed: false, limited: true, degraded: false }
        }

        return { allowed: true, limited: false, degraded: false }
    } catch (error) {
        warnOnce(namespace, error)
        return { allowed: true, limited: false, degraded: true }
    }
}

export async function enforceRateLimit(config: RateLimitConfig): Promise<void> {
    const result = await checkRateLimit(config)
    if (!result.allowed) throw new Error(RATE_LIMIT_ERROR)
}

export const RATE_LIMIT_ERROR = 'Too many requests. Please slow down.'
