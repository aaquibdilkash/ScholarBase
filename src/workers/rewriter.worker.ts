// CPU-only local academic rewriter. Text remains inside the browser.
import { env, pipeline } from "@huggingface/transformers";
import { lockAcademicEntities, unlockAcademicEntities } from "@/lib/shield/masking";
import { boostBurstiness, forceBurstiness } from "@/lib/shield/statistical-analyzer";

env.allowLocalModels = false;
env.allowRemoteModels = true;
if (typeof env.useBrowserCache !== "undefined") env.useBrowserCache = true;

const MODEL = "Xenova/flan-t5-small";
type Device = "wasm" | "webgpu";
let generator: ((text: string, options?: Record<string, unknown>) => Promise<Array<{ generated_text: string }>>) | null = null;
let loadedDevice: Device | null = null;

async function load(device: Device, onProgress: (progress: number) => void) {
  const dtypes = ["q8", "q4", "fp32"];
  let lastError: unknown = null;
  for (const dtype of dtypes) {
    try {
      generator = await pipeline("text2text-generation", MODEL, {
        dtype: dtype as never,
        device,
        progress_callback: (event: Record<string, unknown>) => {
          const status = String(event.status ?? "");
          if (status === "progress") onProgress(Math.round(Number(event.progress ?? 0)));
          else if (status === "done") onProgress(100);
        },
      }) as unknown as typeof generator;
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Local rewriter model failed to load.");
}

type RewriteChunk = { text: string; paragraphBreakAfter: boolean };

function chunks(text: string): RewriteChunk[] {
  const paragraphs = text.split(/\n\s*\n/).filter((part) => part.trim());
  return paragraphs.flatMap((paragraph) => {
    const sentences = paragraph.split(/(?<=[.!?])\s+/).filter(Boolean);
    const result: RewriteChunk[] = [];
    let current = "";
    const sourceSentences = sentences.length ? sentences : [paragraph];
    sourceSentences.forEach((sentence, index) => {
      if (current && current.length + sentence.length + 1 > 520) {
        result.push({ text: current, paragraphBreakAfter: false });
        current = "";
      }
      current = current ? `${current} ${sentence}` : sentence;
      if (index === sourceSentences.length - 1 && current) {
        result.push({ text: current, paragraphBreakAfter: true });
      }
    });
    return result;
  });
}

function hasDegenerateRepetition(text: string): boolean {
  const tokens = text.toLowerCase().match(/[a-z0-9][a-z0-9'’-]*/g) ?? [];
  let run = 1;
  for (let index = 1; index < tokens.length; index += 1) {
    run = tokens[index] === tokens[index - 1] ? run + 1 : 1;
    if (run >= 3) return true;
  }
  return false;
}

function preservesProtectedTokens(source: string, candidate: string): boolean {
  const protectedTokens = source.match(/__[^\s]+__|\b\d+(?:[.,]\d+)*%?\b/g) ?? [];
  return protectedTokens.every((token) => candidate.includes(token));
}

self.addEventListener("message", async (event: MessageEvent) => {
  const { type, text, requestId } = event.data ?? {};
  try {
    if (type === "CHECK_CACHE") {
      let cached = false;
      let bytes = 0;
      if (typeof caches !== "undefined") {
        for (const cacheName of await caches.keys()) {
          const cache = await caches.open(cacheName);
          const requests = await cache.keys();
          for (const request of requests) {
            if (!/Xenova\/flan-t5-small/i.test(request.url) || !/(?:model|config|tokenizer)/i.test(request.url)) continue;
            cached = true;
            const response = await cache.match(request);
            const length = response?.headers.get("content-length");
            bytes += length ? Number(length) : response ? (await response.clone().blob()).size : 0;
          }
        }
      }
      self.postMessage({ status: "cache", cached, bytes, requestId });
      return;
    }
    if (type === "INIT") {
      const device: Device = event.data.device === "webgpu" ? "webgpu" : "wasm";
      if (generator && loadedDevice === device) {
        self.postMessage({ status: "ready", device });
        return;
      }
      generator = null;
      loadedDevice = null;
      await load(device, (progress) => self.postMessage({ status: "downloading", progress, device }));
      loadedDevice = device;
      self.postMessage({ status: "ready" });
      return;
    }
    if (type === "CLEAR_CACHE") {
      generator = null;
      loadedDevice = null;
      let deleted = 0;
      let bytes = 0;
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        for (const key of keys) {
          const cache = await caches.open(key);
          for (const request of await cache.keys()) {
            if (!/Xenova\/flan-t5-small/i.test(request.url)) continue;
            const response = await cache.match(request);
            const length = response?.headers.get("content-length");
            bytes += length ? Number(length) : response ? (await response.clone().blob()).size : 0;
            if (await cache.delete(request)) deleted += 1;
          }
        }
      }
      self.postMessage({ status: "cleared", deleted, bytes, requestId });
      return;
    }
    if (type !== "REWRITE" || !generator || typeof text !== "string") return;

    const { maskedText, restoreMap } = lockAcademicEntities(text);
    const paragraphs: string[] = [];
    let currentParagraph = "";
    const flushParagraph = () => {
      // Run the deterministic burstiness passes on the masked paragraph so the
      // protected-token guard (`__X_n__`) is active. boostBurstiness nudges CV;
      // forceBurstiness pushes absolute σ above the >7 floor by building
      // long-vs-short sentence spread at clause boundaries. Both only
      // re-punctuate existing words, so no claim, number, or citation moves.
      const trimmed = currentParagraph.trim();
      if (!trimmed) return;
      const boosted = boostBurstiness(trimmed, 0.34, 2).text;
      const forced = forceBurstiness(boosted, 7.5, 8).text;
      paragraphs.push(forced.trim());
      currentParagraph = "";
    };
    for (const chunk of chunks(maskedText)) {
      // Cadence-first instruction. The previous prompt demanded a fixed
      // sentence count, which is exactly what keeps sigma flat. We now ask for
      // deliberate sentence-length variation and explicitly ban the formulaic
      // transition list the statistical analyzer flags.
      const prompt = `Rewrite this academic passage so it reads like a person wrote it. Deliberately vary sentence length: mix short, direct sentences with longer, more complex ones, and never make every sentence the same length. Avoid formulaic transitions such as moreover, furthermore, additionally, consequently, importantly, and in summary. Keep every claim, qualification, citation, number, equation, and proper name exactly intact. Never repeat a word or phrase unnecessarily. Do not add facts or remove meaning. Return only the rewritten passage:\n\n${chunk.text}`;
      const inputWordCount = chunk.text.split(/\s+/).filter(Boolean).length;
      const budget = Math.min(512, Math.max(96, Math.round(inputWordCount * 2.2)));
      // A rewrite is safe when it keeps every protected academic token and does
      // not fall into a repetition loop. We deliberately do NOT reject on
      // length parity — that guard was calibrated for FLAN-T5 and was silently
      // discarding well-varied rewrites, which is what kept sigma flat.
      const isSafe = (candidate: string) =>
        candidate.length > 0 && preservesProtectedTokens(chunk.text, candidate) && !hasDegenerateRepetition(candidate);
      const run = (options: Record<string, unknown>) =>
        generator!(prompt, { max_new_tokens: budget, no_repeat_ngram_size: 3, ...options })
          .then((out) => out[0]?.generated_text?.trim() ?? "");
      // Sample as the PRIMARY path. Greedy decoding deterministically picks the
      // single most-likely token every step, which produces uniform sentence
      // lengths and pins sigma low — this is exactly why the current build could
      // not reproduce the previous commit's sigma > 7. Sampling recovers the
      // varied, human-like cadence on-device. Protected-token + repetition
      // guards still apply, and greedy remains the fidelity fallback.
      let candidate = await run({ do_sample: true, temperature: 0.7, top_p: 0.9, repetition_penalty: 1.15 });
      if (!isSafe(candidate)) {
        // Higher diversity to break a repetition loop or regain a dropped token.
        const retry = await run({ do_sample: true, temperature: 0.9, top_p: 0.95, repetition_penalty: 1.25 });
        if (isSafe(retry)) candidate = retry;
      }
      if (!isSafe(candidate)) {
        // Last resort: greedy for maximum fidelity when sampling kept looping.
        const greedy = await run({ do_sample: false, repetition_penalty: 1.15 });
        if (isSafe(greedy)) candidate = greedy;
      }
      // Only fall back to the source when the model truly failed (dropped a
      // protected token or looped) even after the sampling retry.
      currentParagraph = currentParagraph ? `${currentParagraph} ${isSafe(candidate) ? candidate : chunk.text}` : (isSafe(candidate) ? candidate : chunk.text);
      if (chunk.paragraphBreakAfter) flushParagraph();
    }
    flushParagraph();
    self.postMessage({ status: "completed", text: unlockAcademicEntities(paragraphs.join("\n\n").trim(), restoreMap), requestId });
  } catch (error: unknown) {
    self.postMessage({ status: "error", error: error instanceof Error ? error.message : "Local rewrite failed.", requestId });
  }
});
