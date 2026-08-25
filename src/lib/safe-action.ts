import { z } from 'zod'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'
import { getCurrentUser } from '@/lib/auth'

// Initialize outside the function to reuse the connection
const redis = Redis.fromEnv()

const ratelimit = new Ratelimit({
  redis,
  // Adjusted to 10 requests per 10 seconds (better UX for UI interactions)
  limiter: Ratelimit.slidingWindow(10, '10 s'), 
})

export function safeAction<T, R>(
  actionName: string, // 🔥 1. Required action name for isolated limiting
  schema: z.ZodSchema<T>,
  handler: (data: T, userId: string) => Promise<R>
) {
  return async (arg: FormData | Record<string, unknown>): Promise<R | { error: string }> => {
    const user = await getCurrentUser()
    if (!user) {
      return { error: 'Unauthorized' }
    }

    // 🔥 2. Rate limit exclusively by Action + UserID
    const key = `ratelimit:${actionName}:${user.id}`

    const { success } = await ratelimit.limit(key)
    if (!success) {
      return { error: 'Too many requests. Please slow down.' }
    }

    let rawData: Record<string, unknown> = {}
    
    if (arg instanceof FormData) {
      // 🔥 3. Robust FormData parsing that supports arrays
      for (const [key, value] of arg.entries()) {
        if (rawData[key] !== undefined) {
          if (Array.isArray(rawData[key])) {
            (rawData[key] as unknown[]).push(value)
          } else {
            rawData[key] = [rawData[key], value]
          }
        } else {
          rawData[key] = value
        }
      }
    } else {
      rawData = arg as Record<string, unknown>
    }

    const parsed = schema.safeParse(rawData)
    if (!parsed.success) {
      return { error: parsed.error.issues[0].message }
    }

    try {
      return await handler(parsed.data, user.id)
    } catch (error) {
      // Log the actionName for easier debugging in Vercel
      console.error(`[Server Action Error - ${actionName}]:`, error)
      return { error: 'Internal server error.' }
    }
  }
}