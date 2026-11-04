/**
 * Lazy local ONNX MiniLM loader for the embedding worker.
 *
 * `next build` must not download or initialise a model: the import of
 * `@huggingface/transformers` is dynamic and only happens on the first cron
 * invocation. A failed download clears the cached promise so the next run
 * retries instead of pinning the process to a rejected promise.
 *
 * The model files live under `EMBEDDING_CACHE_DIR` (default: a directory in the
 * OS temp dir). In Docker, point that env var at a writable persistent volume
 * so a redeploy does not re-download the model. See
 * `docs/semantic-embeddings.md`.
 */
import { mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { EMBEDDING_DIMENSIONS } from "./vector";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

/**
 * MiniLM truncates at 256 tokens. Capping the character count first keeps CPU
 * and memory predictable for a pathological post/abstract; the tokenizer would
 * discard the tail anyway.
 */
const MAX_TEXT_CHARACTERS = 2_000;

async function loadExtractor() {
  const { env, pipeline } = await import("@huggingface/transformers");

  const cacheDir =
    process.env.EMBEDDING_CACHE_DIR?.trim() ||
    path.join(tmpdir(), "scholarbase-embedding-cache");

  await mkdir(cacheDir, { recursive: true });

  env.cacheDir = cacheDir;
  env.allowLocalModels = false;
  env.allowRemoteModels = true;

  return pipeline("feature-extraction", MODEL_ID, {
    dtype: "q8",
    device: "cpu",
  });
}

type Extractor = Awaited<ReturnType<typeof loadExtractor>>;

let extractorPromise: Promise<Extractor> | null = null;

async function getExtractor(): Promise<Extractor> {
  if (extractorPromise) {
    return extractorPromise;
  }

  const pending = loadExtractor();
  extractorPromise = pending;

  pending.catch(() => {
    if (extractorPromise === pending) {
      extractorPromise = null;
    }
  });

  return pending;
}

/**
 * Embeds a batch and returns one 384-float array per input, in input order.
 * The caller keeps the batch small; this function does not chunk internally so
 * a single cron invocation has one predictable model call.
 */
export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const extractor = await getExtractor();
  const output = await extractor(
    texts.map((text) => text.slice(0, MAX_TEXT_CHARACTERS)),
    { pooling: "mean", normalize: true },
  );

  const rows: number[][] = output.tolist();

  if (rows.length !== texts.length) {
    throw new Error(
      `Embedding model returned ${rows.length} vectors for ${texts.length} inputs.`,
    );
  }

  for (const row of rows) {
    if (!Array.isArray(row) || row.length !== EMBEDDING_DIMENSIONS) {
      throw new Error(
        `Embedding model returned a vector with ${Array.isArray(row) ? row.length : "unknown"} dimensions; expected ${EMBEDDING_DIMENSIONS}.`,
      );
    }
  }

  return rows;
}
