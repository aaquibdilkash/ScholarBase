/**
 * Cron-driven embedding worker.
 *
 * The request path only inserts content and (via the database trigger) an
 * outbox row. This module is the only place that loads the ONNX model or writes
 * a vector, and it runs from `src/app/api/cron/embed-content`.
 *
 * Claim protocol:
 *   1. select due jobs with `FOR UPDATE SKIP LOCKED`, setting `lockedAt`
 *   2. load content, embed the whole batch in one model call
 *   3. write vectors with raw SQL, then delete the exact job version
 *
 * A content edit bumps `EmbeddingJob.version`, so a worker that embedded older
 * text cannot delete the newer job. Its delete matches zero rows and the new
 * version is embedded on a later run. A crashed worker's lock expires after
 * `LOCK_TIMEOUT_MINUTES`, so the job is retried without operator intervention.
 */
import { Prisma } from "@prisma/client";

import prisma from "@/lib/db";

import { embedTexts } from "./model";
import { loadEmbeddingSources, type EmbeddingSourceMap } from "./sources";
import { EMBEDDING_TABLES, type EmbeddingEntityType } from "./text";
import { toVectorLiteral } from "./vector";

export const EMBEDDING_MAX_ATTEMPTS = 5;

const DEFAULT_BATCH_SIZE = 20;
const MAX_BATCH_SIZE = 100;
const LOCK_TIMEOUT_MINUTES = 10;
const MODEL_RETRY_MINUTES = 10;
const RETRY_BASE_MINUTES = 5;

type ClaimedJob = {
  id: string;
  entityType: EmbeddingEntityType;
  entityId: string;
  attempts: number;
  version: number;
};

export type EmbeddingWorkerResult = {
  claimed: number;
  processed: number;
  failed: number;
  skipped: number;
  /** Set when the model could not load; jobs stay queued for a later run. */
  modelUnavailable?: string;
};

export function clampEmbeddingLimit(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_BATCH_SIZE;
  }

  return Math.min(MAX_BATCH_SIZE, Math.max(1, Math.floor(value)));
}

export function embeddingRetryDelayMinutes(attempts: number): number {
  const exponent = Math.max(0, attempts - 1);
  return Math.min(60, RETRY_BASE_MINUTES * 2 ** exponent);
}

function errorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return message.slice(0, 1_000);
}

async function claimJobs(limit: number): Promise<ClaimedJob[]> {
  return prisma.$queryRaw<ClaimedJob[]>`
    WITH claimed AS (
      SELECT "id"
      FROM "EmbeddingJob"
      WHERE "runAt" <= now()
        AND (
          "lockedAt" IS NULL
          OR "lockedAt" < now() - make_interval(mins => ${LOCK_TIMEOUT_MINUTES})
        )
      ORDER BY "runAt", "createdAt"
      LIMIT ${limit}
      FOR UPDATE SKIP LOCKED
    )
    UPDATE "EmbeddingJob" AS job
    SET
      "lockedAt" = now(),
      "updatedAt" = now()
    FROM claimed
    WHERE job."id" = claimed."id"
    RETURNING
      job."id",
      job."entityType",
      job."entityId",
      job."attempts",
      job."version"
  `;
}

function tableReference(entityType: EmbeddingEntityType) {
  return Prisma.raw(`"${EMBEDDING_TABLES[entityType]}"`);
}

async function writeEmbedding(
  entityType: EmbeddingEntityType,
  entityId: string,
  vector: readonly number[],
): Promise<number> {
  const literal = toVectorLiteral(vector);

  return prisma.$executeRaw(Prisma.sql`
    UPDATE ${tableReference(entityType)}
    SET "embedding" = ${literal}::vector
    WHERE "id" = ${entityId} AND "isDeleted" = false
  `);
}

async function clearEmbedding(
  entityType: EmbeddingEntityType,
  entityId: string,
): Promise<number> {
  return prisma.$executeRaw(Prisma.sql`
    UPDATE ${tableReference(entityType)}
    SET "embedding" = NULL
    WHERE "id" = ${entityId}
  `);
}

async function failJob(job: ClaimedJob, error: unknown): Promise<void> {
  const message = errorMessage(error);
  const attempts = job.attempts + 1;

  console.error(
    `[embedding-worker] ${job.entityType}:${job.entityId} attempt ${attempts} failed`,
    error,
  );

  if (attempts >= EMBEDDING_MAX_ATTEMPTS) {
    await prisma.embeddingJob.deleteMany({
      where: { id: job.id, version: job.version },
    });
    return;
  }

  await prisma.embeddingJob.updateMany({
    where: { id: job.id, version: job.version },
    data: {
      attempts,
      lockedAt: null,
      runAt: new Date(
        Date.now() + embeddingRetryDelayMinutes(attempts) * 60_000,
      ),
      lastError: message,
    },
  });
}

async function releaseForModelFailure(
  jobs: ClaimedJob[],
  error: unknown,
): Promise<string> {
  const message = errorMessage(error);

  await prisma.embeddingJob.updateMany({
    where: {
      OR: jobs.map((job) => ({ id: job.id, version: job.version })),
    },
    data: {
      lockedAt: null,
      runAt: new Date(Date.now() + MODEL_RETRY_MINUTES * 60_000),
      lastError: message,
    },
  });

  return message;
}

/**
 * Claims and processes one bounded batch. Never throws for model or per-row
 * failures: the cron route needs a stable result shape, and the outbox is the
 * retry mechanism.
 */
export async function runEmbeddingWorker(options?: {
  limit?: number;
}): Promise<EmbeddingWorkerResult> {
  const limit = clampEmbeddingLimit(options?.limit);
  const jobs = await claimJobs(limit);

  if (jobs.length === 0) {
    return { claimed: 0, processed: 0, failed: 0, skipped: 0 };
  }

  const idsByType = Object.fromEntries(
    (Object.keys(EMBEDDING_TABLES) as EmbeddingEntityType[]).map(
      (entityType) => [entityType, [] as string[]],
    ),
  ) as Record<EmbeddingEntityType, string[]>;

  for (const job of jobs) {
    idsByType[job.entityType].push(job.entityId);
  }

  // One `findMany` per entity type present in the batch; entity types with no
  // claimed jobs short-circuit inside `loadEmbeddingSources`.
  const sourceMaps = Object.fromEntries(
    await Promise.all(
      (Object.keys(EMBEDDING_TABLES) as EmbeddingEntityType[]).map(
        async (entityType) => [
          entityType,
          await loadEmbeddingSources(entityType, idsByType[entityType]),
        ],
      ),
    ),
  ) as Record<EmbeddingEntityType, EmbeddingSourceMap>;

  const candidates: Array<{ job: ClaimedJob; text: string }> = [];
  const staleJobs: ClaimedJob[] = [];
  const emptyJobs: ClaimedJob[] = [];

  for (const job of jobs) {
    const source = sourceMaps[job.entityType].get(job.entityId);

    if (!source || source.isDeleted) {
      staleJobs.push(job);
      continue;
    }

    if (!source.text) {
      emptyJobs.push(job);
      continue;
    }

    candidates.push({ job, text: source.text });
  }

  let skipped = 0;

  if (staleJobs.length > 0) {
    await prisma.embeddingJob.deleteMany({
      where: {
        OR: staleJobs.map((job) => ({
          id: job.id,
          version: job.version,
        })),
      },
    });
    skipped += staleJobs.length;
  }

  for (const job of emptyJobs) {
    const deleted = await prisma.embeddingJob.deleteMany({
      where: { id: job.id, version: job.version },
    });

    skipped += 1;

    // A newer edit re-queued the entity; do not clear the vector it is about
    // to write (or has just written) from the current job's stale view.
    if (deleted.count === 0) {
      continue;
    }

    try {
      await clearEmbedding(job.entityType, job.entityId);
    } catch (error) {
      console.error(
        `[embedding-worker] failed to clear empty embedding for ${job.entityType}:${job.entityId}`,
        error,
      );
    }
  }

  if (candidates.length === 0) {
    return {
      claimed: jobs.length,
      processed: 0,
      failed: 0,
      skipped,
    };
  }

  let vectors: number[][];

  try {
    vectors = await embedTexts(candidates.map((candidate) => candidate.text));
  } catch (error) {
    const message = await releaseForModelFailure(jobs, error);

    return {
      claimed: jobs.length,
      processed: 0,
      failed: 0,
      skipped,
      modelUnavailable: message,
    };
  }

  let processed = 0;
  let failed = 0;
  const completed: ClaimedJob[] = [];

  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];

    try {
      const updated = await writeEmbedding(
        candidate.job.entityType,
        candidate.job.entityId,
        vectors[index],
      );

      completed.push(candidate.job);

      if (updated > 0) {
        processed += 1;
      } else {
        // The row was hard- or soft-deleted after it was loaded. The trigger
        // normally removed the job already; deleting this version is a no-op.
        skipped += 1;
      }
    } catch (error) {
      failed += 1;

      try {
        await failJob(candidate.job, error);
      } catch (retryError) {
        // Leave the lock in place; it expires and the job is retried later.
        console.error(
          `[embedding-worker] failed to record retry for ${candidate.job.entityType}:${candidate.job.entityId}`,
          retryError,
        );
      }
    }
  }

  if (completed.length > 0) {
    // Only delete the versions that were actually embedded. A concurrent edit
    // bumped `version`, so its job stays queued and is picked up next run.
    await prisma.embeddingJob.deleteMany({
      where: {
        OR: completed.map((job) => ({ id: job.id, version: job.version })),
      },
    });
  }

  return {
    claimed: jobs.length,
    processed,
    failed,
    skipped,
  };
}
