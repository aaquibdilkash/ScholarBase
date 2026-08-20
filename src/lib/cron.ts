import { headers } from 'next/headers';
import {env} from '@/lib/env';

export async function verifyCronSecret(): Promise<boolean> {
  const headersList = await headers();
  const authHeader = headersList.get('authorization');
  return authHeader === `Bearer ${env.CRON_SECRET}`;
}