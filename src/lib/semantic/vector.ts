/**
 * pgvector literal formatting.
 *
 * The app never casts a JS array to `vector` directly (the pg adapter would
 * send an array, not a vector). Every write goes through this formatter and the
 * SQL `::vector` cast, so a malformed or short vector fails before it reaches
 * the database.
 */

export const EMBEDDING_DIMENSIONS = 384;

export function toVectorLiteral(vector: readonly number[]): string {
  if (vector.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Expected a ${EMBEDDING_DIMENSIONS}-dimensional embedding, received ${vector.length}.`,
    );
  }

  const parts = new Array<string>(vector.length);

  for (let index = 0; index < vector.length; index += 1) {
    const value = vector[index];

    if (!Number.isFinite(value)) {
      throw new Error(
        `Embedding value at index ${index} is not finite: ${String(value)}.`,
      );
    }

    // Six decimals is well inside float4/vector precision and keeps the
    // literal small enough to stay under PostgreSQL's parameter limits.
    parts[index] = value.toFixed(6);
  }

  return `[${parts.join(",")}]`;
}
