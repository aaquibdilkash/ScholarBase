// src/workers/detector.worker.ts
// ONNX sequence classifier in a Web Worker. Paper never leaves the device.
import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.allowRemoteModels = true;
if (typeof env.useBrowserCache !== "undefined") {
  env.useBrowserCache = true;
}

// Modern browser-compatible detector trained on the RAID benchmark.
const DEFAULT_MODEL = "onnx-community/tmr-ai-text-detector-ONNX";
const MODEL_URL_PATTERN = /tmr-ai-text-detector-ONNX/i;
const LEGACY_MODEL_URL_PATTERN = /roberta-base-openai-detector-ONNX/i;
const CACHE_MARKER_URL = new URL("/.scholar-shield-tmr-cache-complete", self.location.origin).href;
let cancelRequested = false;

let classifier: {
  (
    text: string,
    options?: { top_k?: number | null },
  ): Promise<{ label: string; score: number }[]>;
} | null = null;

async function loadClassifier(
  onProgress: (pct: number, file: string) => void,
) {
  // Prefer the small browser bundle, then fall back to larger compatible files.
  const attempts: Array<{ dtype: string }> = [
    { dtype: "q4f16" },
    { dtype: "q8" },
    { dtype: "fp32" },
  ];
  let lastErr: unknown = null;
  for (const { dtype } of attempts) {
    try {
      const c = await pipeline("text-classification", DEFAULT_MODEL, {
        dtype: dtype as never,
        device: "wasm",
        progress_callback: (p: Record<string, unknown>) => {
          const status = p?.status as string | undefined;
          if (status === "progress") {
            const pct = Math.round(Number(p.progress ?? 0));
            onProgress(pct, String(p.file ?? ""));
          } else if (status === "download" || status === "initiate") {
            onProgress(0, String(p.file ?? ""));
          } else if (status === "done") {
            onProgress(100, String(p.file ?? ""));
          }
        },
      });
      return c as typeof classifier;
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Model load failed.");
}

async function clearDetectorCache() {
  let deleted = 0;
  let bytes = 0;
  if (typeof caches !== "undefined") {
    for (const key of await caches.keys()) {
      const cache = await caches.open(key);
      for (const request of await cache.keys()) {
        if (request.url !== CACHE_MARKER_URL && !MODEL_URL_PATTERN.test(request.url) && !LEGACY_MODEL_URL_PATTERN.test(request.url)) continue;
        const response = await cache.match(request);
        const length = response?.headers.get("content-length");
        bytes += length ? Number(length) : response ? (await response.clone().blob()).size : 0;
        if (await cache.delete(request)) deleted += 1;
      }
    }
  }
  return { deleted, bytes };
}

async function markDetectorCacheComplete() {
  if (typeof caches === "undefined") return;
  const cache = await caches.open("scholar-shield-models");
  await cache.put(CACHE_MARKER_URL, new Response("complete", { headers: { "content-type": "text/plain" } }));
}

function sanitizeAcademicText(rawText: string): string {
  return rawText
    .replace(/\$\$[\s\S]*?\$\$/g, " [EQUATION] ")
    .replace(/\$[^\n$]*?\$/g, " [MATH] ")
    .replace(/\\\[[\s\S]*?\\\]/g, " [EQUATION] ")
    .replace(/\\\([\s\S]*?\\\)/g, " [MATH] ")
    .replace(/\[\s*\d+(?:\s*[-–]\s*\d+)?(?:\s*,\s*\d+(?:\s*[-–]\s*\d+)?)*\s*\]/g, " ")
    .replace(/\(([A-Z][a-zA-Z]+(?:\s+et\s+al\.)?,?\s+\d{4}[a-z]?)\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function makeSlidingWindows(text: string, windowWords = 250, strideWords = 200): string[] {
  const words = text.match(/\S+/g) ?? [];
  if (words.length <= windowWords) return words.length >= 12 ? [words.join(" ")] : [];
  const windows: string[] = [];
  for (let start = 0; start < words.length; start += strideWords) {
    const window = words.slice(start, start + windowWords);
    if (window.length < 12) break;
    windows.push(window.join(" "));
    if (start + windowWords >= words.length) break;
  }
  const tailStart = Math.max(0, words.length - windowWords);
  const tail = words.slice(tailStart, tailStart + windowWords).join(" ");
  if (tail && windows[windows.length - 1] !== tail) windows.push(tail);
  return windows;
}

self.addEventListener("message", async (e: MessageEvent) => {
  const { type, data } = e.data ?? {};
  if (type === "CHECK_CACHE") {
    try {
      let cached = false;
      let bytes = 0;
      if (typeof caches !== "undefined") {
        let markerFound = false;
        for (const cacheName of await caches.keys()) {
          const cache = await caches.open(cacheName);
          const requests = await cache.keys();
          for (const request of requests) {
            if (request.url === CACHE_MARKER_URL) markerFound = true;
            if (!MODEL_URL_PATTERN.test(request.url) || !/(?:model|config|tokenizer)/i.test(request.url)) continue;
            const response = await cache.match(request);
            const length = response?.headers.get("content-length");
            bytes += length ? Number(length) : response ? (await response.clone().blob()).size : 0;
          }
        }
        if (markerFound && bytes > 0) cached = true;
        else if (bytes > 0) {
          await clearDetectorCache();
          bytes = 0;
        }
      }
      self.postMessage({ status: "cache", cached, bytes });
    } catch {
      self.postMessage({ status: "cache", cached: false, bytes: 0 });
    }
    return;
  }
  if (type === "INIT_MODEL") {
    try {
      cancelRequested = false;
      self.postMessage({ status: "loading", progress: 0 });
      classifier = await loadClassifier((pct) => {
        self.postMessage({ status: "downloading", progress: pct });
      });
      if (cancelRequested) {
        await clearDetectorCache();
        self.postMessage({ status: "cancelled" });
        return;
      }
      await markDetectorCacheComplete();
      self.postMessage({ status: "ready" });
    } catch (err: unknown) {
      self.postMessage({
        status: "error",
        error: err instanceof Error ? err.message : "Model load failed.",
      });
    }
  }
  if (type === "CANCEL_MODEL") {
    cancelRequested = true;
    classifier = null;
    const cleared = await clearDetectorCache();
    self.postMessage({ status: "cancelled", ...cleared });
    return;
  }
  if (type === "CLEAR_CACHE") {
    classifier = null;
    try {
      const { deleted, bytes } = await clearDetectorCache();
      self.postMessage({ status: "cleared", deleted, bytes });
    } catch (err: unknown) {
      self.postMessage({
        status: "error",
        error: err instanceof Error ? err.message : "Cache clear failed.",
      });
    }
    return;
  }
  if (type === "SCAN_PARAGRAPHS") {
    if (!classifier) {
      self.postMessage({ status: "error", error: "Model not initialized." });
      return;
    }
    try {
      const paragraphs: string[] = data?.paragraphs ?? [];
      const scores: number[] = [];
      const perWindow: Array<{
        text: string;
        score: number;
        aiProb: number;
        humanProb: number | null;
        argmaxLabel: string;
      }> = [];
      let totalWords = 0;
      let chunkCount = 0;
      let weightedSum = 0;
      const scanStartedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      for (const para of paragraphs) {
        const sanitized = sanitizeAcademicText(para);
        for (const chunk of makeSlidingWindows(sanitized)) {
          const words = chunk.match(/\S+/g)?.length ?? 0;
          // TMR maps human -> LABEL_0 and AI -> LABEL_1.
          const out = await classifier(chunk, { top_k: null });
          const classes = Array.isArray(out) ? out : [out];
          const normalized = (label: unknown) => String(label ?? "").toLowerCase();
          const aiEntry = classes.find((entry) =>
            normalized(entry.label) === "ai" ||
            normalized(entry.label) === "label_1" ||
            /fake|generated/.test(normalized(entry.label)),
          );
          const humanEntry = classes.find((entry) =>
            normalized(entry.label) === "human" ||
            normalized(entry.label) === "label_0" ||
            /real/.test(normalized(entry.label)),
          );
          const score = aiEntry ? aiEntry.score : humanEntry ? 1 - humanEntry.score : (classes[0]?.score ?? 0);
          const argmaxLabel = classes[0]?.label ?? "";
          scores.push(score);
          // Per-window diagnostics alongside the text so the UI (and console)
          // can highlight exactly which sentences the neural model flags AND see
          // WHY a flat score appears. Additive: consumers reading only `score`
          // are unaffected.
          perWindow.push({
            text: chunk,
            score: Math.round(score * 100),
            aiProb: score,
            humanProb: humanEntry?.score ?? null,
            argmaxLabel,
          });
          totalWords += words;
          weightedSum += score * words;
          chunkCount++;
        }
      }
      if (perWindow.length && typeof console !== "undefined") {
        const sample = perWindow[0];
        const finishedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
        console.debug("[Shield/Detector] TMR diagnostic", {
          windows: chunkCount,
          words: totalWords,
          elapsedMs: Math.round(finishedAt - scanStartedAt),
          sampleLabel: sample.argmaxLabel,
          sampleAiProbability: Number(sample.aiProb.toFixed(4)),
          sampleHumanProbability: sample.humanProb === null ? null : Number(sample.humanProb.toFixed(4)),
        });
      }
      self.postMessage({ status: "completed", scores, perWindow, totalWords, weightedSum, chunkCount });
    } catch (err: unknown) {
      self.postMessage({
        status: "error",
        error: err instanceof Error ? err.message : "Inference failed.",
      });
    }
  }
});
