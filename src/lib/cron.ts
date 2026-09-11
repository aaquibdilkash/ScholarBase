import { headers } from 'next/headers'
import { timingSafeEqual } from 'node:crypto'

export async function verifyCronSecret(): Promise<boolean> {
  const headersList = await headers()
  const authHeader = headersList.get('authorization')
  const secret = process.env.CRON_SECRET

  if (!secret) {
    return false
  }

  const provided = authHeader?.replace(/^Bearer\s+/i, '') ?? ''
  const expected = Buffer.from(secret)
  const actual = Buffer.from(provided)

  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
