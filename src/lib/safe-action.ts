import { z } from 'zod'
import { getCurrentUser } from '@/lib/auth'
import { checkRateLimit, RATE_LIMIT_ERROR } from '@/lib/rate-limit'

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

    const rateLimit = await checkRateLimit({
      namespace: `action:${actionName}`,
      key: user.id,
      limit: 10,
      window: '10 s',
    })

    if (!rateLimit.allowed) {
      return { error: RATE_LIMIT_ERROR }
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