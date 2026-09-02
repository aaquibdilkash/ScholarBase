import { headers } from 'next/headers'

export async function verifyCronSecret(): Promise<boolean> {
  const headersList = await headers()
  const authHeader = headersList.get('authorization')
  const secret = process.env.CRON_SECRET

  if (!secret) {
    return false
  }

  return authHeader === `Bearer ${secret}`
}