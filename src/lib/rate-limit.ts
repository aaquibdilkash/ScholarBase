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

export function getRequestFingerprint(headers: Headers): string {
    const forwardedFor = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    const realIp = headers.get('x-real-ip')?.trim()
    const userAgent = headers.get('user-agent')?.trim() ?? ''
    const rawFingerprint = `${forwardedFor || realIp || 'unknown'}|${userAgent}`

    return hashRateLimitKey(rawFingerprint)
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

export const RATE_LIMIT_ERROR = 'Too many requests. Please slow down.'