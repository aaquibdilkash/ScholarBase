// src/workers/detector.worker.ts
// ONNX sequence classifier in a Web Worker. Paper never leaves the device.
import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.allowRemoteModels = true;
if (typeof env.useBrowserCache !== "undefined") {
  env.useBrowserCache = true;
}

// Public, Apache-2.0 ONNX conversion maintained by onnx-community.
// TMR: Target Mining RoBERTa, trained with hard-negative mining on RAID.
// The ONNX conversion supports Transformers.js in the browser. Its labels are
// LABEL_0 = human and LABEL_1 = AI.
const DEFAULT_MODEL = "onnx-community/tmr-ai-text-detector-ONNX";

let classifier: {
  (
    text: string,
    options?: { top_k?: number | null },
  ): Promise<{ label: string; score: number }[]>;
} | null = null;

// Binary text classifiers exported from this model are strongly overconfident
// out of domain. Compress the raw logit before displaying it so a probability
// of 0.999 is not presented as a categorical 100% verdict. This changes only
// the Deep Neural confidence scale; class direction remains LABEL_1 = AI.
function calibrateConfidence(probability: number): number {
  const p = Math.min(1 - 1e-6, Math.max(1e-6, probability));
  const logit = Math.log(p / (1 - p));
  return 1 / (1 + Math.exp(-logit / 2.5));
}

async function loadClassifier(
  onProgress: (pct: number, file: string) => void,
) {
  // Prefer quantized browser bundles, then fall back to full precision.
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

self.addEventListener("message", async (e: MessageEvent) => {
  const { type, data } = e.data ?? {};
  if (type === "CHECK_CACHE") {
    try {
      let cached = false;
      let bytes = 0;
      if (typeof caches !== "undefined") {
        for (const cacheName of await caches.keys()) {
          const cache = await caches.open(cacheName);
          const requests = await cache.keys();
          for (const request of requests) {
            if (!/tmr-ai-text-detector-ONNX/i.test(request.url) || !/(?:model|config|tokenizer)/i.test(request.url)) continue;
            cached = true;
            const response = await cache.match(request);
            const length = response?.headers.get("content-length");
            bytes += length ? Number(length) : response ? (await response.clone().blob()).size : 0;
          }
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
      self.postMessage({ status: "loading", progress: 0 });
      classifier = await loadClassifier((pct) => {
        self.postMessage({ status: "downloading", progress: pct });
      });
      self.postMessage({ status: "ready" });
    } catch (err: unknown) {
      self.postMessage({
        status: "error",
        error: err instanceof Error ? err.message : "Model load failed.",
      });
    }
  }
  if (type === "CLEAR_CACHE") {
    classifier = null;
    try {
      let deleted = 0;
      let bytes = 0;
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        for (const key of keys) {
          const cache = await caches.open(key);
          for (const request of await cache.keys()) {
            if (!/tmr-ai-text-detector-ONNX/i.test(request.url)) continue;
            const response = await cache.match(request);
            const length = response?.headers.get("content-length");
            bytes += length ? Number(length) : response ? (await response.clone().blob()).size : 0;
            if (await cache.delete(request)) deleted += 1;
          }
        }
      }
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
      for (const para of paragraphs) {
        // Keep sentence boundaries where possible and never discard the tail
        // Window by sentence so the UI can highlight per-sentence risk.
        const sentences = para.split(/(?<=[.!?])\s+/).filter(Boolean);
        const chunks: string[] = [];
        let current = "";
        for (const sentence of sentences.length ? sentences : [para]) {
          if (current && (current.length + sentence.length + 1 > 1800)) {
            chunks.push(current);
            current = "";
          }
          current = current ? `${current} ${sentence}` : sentence;
        }
        if (current) chunks.push(current);
        for (const chunk of chunks) {
          const words = chunk.match(/\S+/g)?.length ?? 0;
          if (words < 12) continue;
          // Ask for BOTH class probabilities. top_k:null returns the full
          // per-class array for a single input, so we read P(ai) directly by
          // label instead of via `1 - score`. Reading by label matters:
          // (a) if the ONNX port ever inverted the class order, the complement
          // trick would silently re-invert it; (b) it lets us tell a flat "1%"
          // caused by domain miscalibration (argmax "human" at high confidence)
          // apart from a true label inversion (AI text scoring "human").
          const out = await classifier(chunk, { top_k: null });
          const classes = Array.isArray(out) ? out : [out];
          const norm = (l: unknown) => String(l ?? "").toLowerCase();
          const aiEntry = classes.find(
            (c) =>
              norm(c.label) === "ai" ||
              norm(c.label) === "label_1" ||
              /fake|generated/.test(norm(c.label)),
          );
          const humanEntry = classes.find(
            (c) =>
              norm(c.label) === "human" ||
              norm(c.label) === "label_0" ||
              /real|human/.test(norm(c.label)),
          );
          const argmaxLabel = classes[0]?.label ?? "";
          // TMR maps LABEL_1 to AI and LABEL_0 to human. Prefer the explicit AI
          // probability, falling back to the complement of human only if needed.
          const rawScore = aiEntry
            ? aiEntry.score
            : humanEntry
              ? 1 - humanEntry.score
              : (classes[0]?.score ?? 0);
          const score = calibrateConfidence(rawScore);
          scores.push(score);
          // Per-window diagnostics alongside the text so the UI (and console)
          // can highlight exactly which sentences the neural model flags AND see
          // WHY a flat score appears. Additive: consumers reading only `score`
          // are unaffected.
          perWindow.push({
            text: chunk,
            score: Math.round(score * 100),
            aiProb: score,
            humanProb: humanEntry ? humanEntry.score : null,
            argmaxLabel,
          });
          totalWords += words;
          weightedSum += score * words;
          chunkCount++;
        }
      }
      // Diagnostic breadcrumb: log one representative window so a persistent
      // "1%" can be diagnosed from the console. argmax "human" + high humanProb
      // on AI-looking text => domain miscalibration (H1); argmax "human" but the
      // classes appear swapped (ai text labeled human) => ONNX inversion (H2).
      if (perWindow.length && typeof console !== "undefined") {
        const rep = perWindow[0];
        console.debug(
          `[Shield/Detector] ${chunkCount} windows, weighted AI ${Math.round(((weightedSum / Math.max(1, totalWords)) || 0) * 100)}% — sample: argmax="${rep.argmaxLabel}" P(ai)=${rep.aiProb.toFixed(3)} P(human)=${rep.humanProb?.toFixed(3) ?? "n/a"}`,
        );
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
