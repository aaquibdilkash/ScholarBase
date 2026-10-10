let worker: Worker | null = null;
let loading: Promise<void> | null = null;
let requestId = 0;
let loadedDevice: LocalDevice | null = null;
let loadingDevice: LocalDevice | null = null;

export type LocalDevice = "wasm" | "webgpu";

export async function isLocalGpuAvailable(): Promise<boolean> {
  if (typeof navigator === "undefined") return false;
  const gpu = (navigator as Navigator & {
    gpu?: { requestAdapter?: (options?: { powerPreference?: "low-power" | "high-performance" }) => Promise<unknown> };
  }).gpu;
  if (!gpu?.requestAdapter) return false;
  try {
    return Boolean(await gpu.requestAdapter({ powerPreference: "high-performance" }));
  } catch {
    return false;
  }
}

function getWorker(): Worker {
  if (!worker) worker = new Worker(new URL("../../workers/rewriter.worker.ts", import.meta.url), { type: "module" });
  return worker;
}

export function rewriteWithLocalModel(text: string, device: LocalDevice, onProgress?: (progress: number) => void): Promise<string> {
  return initializeLocalModel(device, onProgress).then(() => rewriteLoadedLocalModel(text));
}

export function initializeLocalModel(device: LocalDevice, onProgress?: (progress: number) => void): Promise<void> {
  const currentWorker = getWorker();
  if (loadedDevice === device) return Promise.resolve();
  if (loading && loadingDevice === device) return loading;
  if (loading) return loading.then(() => initializeLocalModel(device, onProgress));
  loadingDevice = device;
  if (!loading) {
    loading = new Promise<void>((resolve, reject) => {
      const onMessage = (event: MessageEvent) => {
        if (event.data?.status === "downloading") onProgress?.(event.data.progress ?? 0);
        if (event.data?.status === "ready") { loadedDevice = device; loadingDevice = null; currentWorker.removeEventListener("message", onMessage); resolve(); }
        if (event.data?.status === "error") { loadingDevice = null; currentWorker.removeEventListener("message", onMessage); reject(new Error(event.data.error)); }
      };
      currentWorker.addEventListener("message", onMessage);
      currentWorker.postMessage({ type: "INIT", device });
    }).catch((error) => { loading = null; throw error; });
  }
  return loading;
}

export function checkLocalModelCache(): Promise<{ cached: boolean; bytes: number }> {
  const currentWorker = getWorker();
  return new Promise((resolve) => {
    const id = ++requestId;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.status !== "cache" || event.data?.requestId !== id) return;
      currentWorker.removeEventListener("message", onMessage);
      resolve({ cached: Boolean(event.data.cached), bytes: Number(event.data.bytes ?? 0) });
    };
    currentWorker.addEventListener("message", onMessage);
    currentWorker.postMessage({ type: "CHECK_CACHE", requestId: id });
  });
}

function rewriteLoadedLocalModel(text: string): Promise<string> {
  const currentWorker = getWorker();
  return new Promise<string>((resolve, reject) => {
    const id = ++requestId;
    const onMessage = (event: MessageEvent) => {
      if (event.data?.requestId !== id) return;
      currentWorker.removeEventListener("message", onMessage);
      if (event.data?.status === "error") reject(new Error(event.data.error));
      else resolve(String(event.data.text ?? ""));
    };
    currentWorker.addEventListener("message", onMessage);
    currentWorker.postMessage({ type: "REWRITE", text, requestId: id });
  });
}

export function clearLocalModelCache(): Promise<{ deleted: number; bytes: number }> {
  const currentWorker = getWorker();
  return new Promise((resolve) => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.status !== "cleared") return;
      currentWorker.removeEventListener("message", onMessage);
      loading = null;
      loadedDevice = null;
      loadingDevice = null;
      resolve({ deleted: Number(event.data.deleted ?? 0), bytes: Number(event.data.bytes ?? 0) });
    };
    currentWorker.addEventListener("message", onMessage);
    currentWorker.postMessage({ type: "CLEAR_CACHE", requestId: ++requestId });
  });
}
