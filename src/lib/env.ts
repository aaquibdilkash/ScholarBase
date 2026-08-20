import { z } from 'zod';

const envSchema = z.object({
  CRON_SECRET: z.string().min(1),
});

export const env = envSchema.parse(process.env);
