// src/workers/detector.worker.ts
// ONNX sequence classifier in a Web Worker. Paper never leaves the device.
import { pipeline, env } from "@huggingface/transformers";

env.allowLocalModels = false;
env.allowRemoteModels = true;
if (typeof env.useBrowserCache !== "undefined") {
  env.useBrowserCache = true;
}

// Public, ungated ONNX conversion maintained by onnx-community.
// Old `Xenova/roberta-base-openai-detector` is gated/renamed -> 401 Unauthorized.
const DEFAULT_MODEL = "onnx-community/roberta-base-openai-detector-ONNX";

let classifier: {
  (text: string): Promise<{ label: string; score: number }[]>;
} | null = null;

async function loadClassifier(
  onProgress: (pct: number, file: string) => void,
) {
  // Try smallest first (q8 ~95MB), fall back to fp32 (~500MB) if missing.
  const attempts: Array<{ dtype: string }> = [{ dtype: "q8" }, { dtype: "fp32" }];
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
      if (typeof caches !== "undefined") {
        const keys = await caches.keys();
        const targets = keys.filter((k) => /transformers|huggingface|onnx|xenova/i.test(k));
        await Promise.all(targets.map((k) => caches.delete(k)));
        deleted = targets.length;
      }
      self.postMessage({ status: "cleared", deleted });
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
      for (const para of paragraphs) {
        const out = await classifier(para.slice(0, 1800));
        const item = out[0];
        const isAi = /fake|label_1|ai|chatgpt/i.test(item.label);
        scores.push(isAi ? item.score : 1 - item.score);
      }
      self.postMessage({ status: "completed", scores });
    } catch (err: unknown) {
      self.postMessage({
        status: "error",
        error: err instanceof Error ? err.message : "Inference failed.",
      });
    }
  }
});
