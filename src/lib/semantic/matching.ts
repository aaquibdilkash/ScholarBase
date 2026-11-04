/**
 * Cosine-similarity lookups over the materialized embeddings.
 *
 * These are recommendation inputs, not search. Callers decide whether to
 * notify, cache, or render a match; the queries only return ids and scores.
 * Every query:
 *   - requires a source vector (no row yet means "not embedded")
 *   - filters `isDeleted = false`
 *   - excludes the source author/self
 *   - orders by pgvector cosine distance (`<=>`) so the partial HNSW index can
 *     serve the top-N
 *
 * The source vector is a scalar subquery, not a joined column. pgvector can
 * only use HNSW when the distance operand is known at plan time (an InitPlan);
 * the equivalent `WITH source AS (...) CROSS JOIN source` shape degrades to a
 * sequential scan plus sort. Keep the repeated subquery when editing these.
 *
 * `<=>` returns distance (0 = identical), so similarity is `1 - distance`.
 */
import prisma from "@/lib/db";

export type SemanticMatch = {
  id: string;
  similarity: number;
};

const DEFAULT_MATCH_LIMIT = 10;
const MAX_MATCH_LIMIT = 50;

export function clampMatchLimit(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) {
    return DEFAULT_MATCH_LIMIT;
  }

  return Math.min(MAX_MATCH_LIMIT, Math.max(1, Math.floor(value)));
}

function toMatches(
  rows: Array<{ id: string; similarity: number | string }>,
): SemanticMatch[] {
  return rows.map((row) => ({
    id: row.id,
    similarity: Number(row.similarity),
  }));
}

/** Scholars whose profiles are semantically close to a social post. */
export async function findScholarsForPost(
  postId: string,
  limit?: number,
): Promise<SemanticMatch[]> {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; similarity: number | string }>
  >`
    SELECT
      scholar."id",
      (
        1 - (
          scholar."embedding" <=> (
            SELECT "embedding"
            FROM "SocialPost"
            WHERE "id" = ${postId}
              AND "isDeleted" = false
              AND "embedding" IS NOT NULL
          )
        )
      )::float8 AS "similarity"
    FROM "User" AS scholar
    WHERE scholar."isDeleted" = false
      AND scholar."embedding" IS NOT NULL
      AND scholar."id" <> (
        SELECT "authorId"
        FROM "SocialPost"
        WHERE "id" = ${postId}
          AND "isDeleted" = false
          AND "embedding" IS NOT NULL
      )
    ORDER BY scholar."embedding" <=> (
      SELECT "embedding"
      FROM "SocialPost"
      WHERE "id" = ${postId}
        AND "isDeleted" = false
        AND "embedding" IS NOT NULL
    )
    LIMIT ${clampMatchLimit(limit)}
  `;

  return toMatches(rows);
}

/** Scholars whose profiles are semantically close to another scholar. */
export async function findSimilarScholars(
  userId: string,
  limit?: number,
): Promise<SemanticMatch[]> {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; similarity: number | string }>
  >`
    SELECT
      scholar."id",
      (
        1 - (
          scholar."embedding" <=> (
            SELECT "embedding"
            FROM "User"
            WHERE "id" = ${userId}
              AND "isDeleted" = false
              AND "embedding" IS NOT NULL
          )
        )
      )::float8 AS "similarity"
    FROM "User" AS scholar
    WHERE scholar."isDeleted" = false
      AND scholar."embedding" IS NOT NULL
      AND scholar."id" <> (
        SELECT "id"
        FROM "User"
        WHERE "id" = ${userId}
          AND "isDeleted" = false
          AND "embedding" IS NOT NULL
      )
    ORDER BY scholar."embedding" <=> (
      SELECT "embedding"
      FROM "User"
      WHERE "id" = ${userId}
        AND "isDeleted" = false
        AND "embedding" IS NOT NULL
    )
    LIMIT ${clampMatchLimit(limit)}
  `;

  return toMatches(rows);
}

/** Scholars whose profiles are semantically close to a publication abstract. */
export async function findScholarsForPublication(
  publicationId: string,
  limit?: number,
): Promise<SemanticMatch[]> {
  const rows = await prisma.$queryRaw<
    Array<{ id: string; similarity: number | string }>
  >`
    SELECT
      scholar."id",
      (
        1 - (
          scholar."embedding" <=> (
            SELECT "embedding"
            FROM "Publication"
            WHERE "id" = ${publicationId}
              AND "isDeleted" = false
              AND "embedding" IS NOT NULL
          )
        )
      )::float8 AS "similarity"
    FROM "User" AS scholar
    WHERE scholar."isDeleted" = false
      AND scholar."embedding" IS NOT NULL
      AND scholar."id" <> (
        SELECT "authorId"
        FROM "Publication"
        WHERE "id" = ${publicationId}
          AND "isDeleted" = false
          AND "embedding" IS NOT NULL
      )
    ORDER BY scholar."embedding" <=> (
      SELECT "embedding"
      FROM "Publication"
      WHERE "id" = ${publicationId}
        AND "isDeleted" = false
        AND "embedding" IS NOT NULL
    )
    LIMIT ${clampMatchLimit(limit)}
  `;

  return toMatches(rows);
}
