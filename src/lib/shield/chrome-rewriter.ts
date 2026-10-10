// Chrome's built-in Gemini Nano Rewriter API is browser-local and experimental.
// It is intentionally feature-detected: Safari, Firefox, mobile Chrome, and
// unsupported Chrome installations continue to use the Groq provider.

type RewriterInstance = {
  rewrite(text: string, options?: { context?: string }): Promise<string>;
  destroy?: () => void;
};

type RewriterConstructor = {
  availability(): Promise<"available" | "downloadable" | "downloading" | "unavailable">;
  create(options?: {
    tone?: "more-formal" | "as-is" | "more-casual";
    format?: "as-is" | "markdown" | "plain-text";
    length?: "shorter" | "as-is" | "longer";
    sharedContext?: string;
    monitor?: (monitor: EventTarget) => void;
  }): Promise<RewriterInstance>;
};

function getRewriter(): RewriterConstructor | null {
  if (typeof window === "undefined") return null;
  return (globalThis as typeof globalThis & { Rewriter?: RewriterConstructor }).Rewriter ?? null;
}

export async function getChromeRewriterAvailability(): Promise<"available" | "downloadable" | "downloading" | "unavailable"> {
  const rewriter = getRewriter();
  if (!rewriter) return "unavailable";
  try {
    return await rewriter.availability();
  } catch {
    return "unavailable";
  }
}

export async function rewriteWithChrome(text: string, onProgress?: (progress: number) => void): Promise<string> {
  const rewriter = getRewriter();
  if (!rewriter) throw new Error("Gemini Nano is not available in this browser.");

  const session = await rewriter.create({
    tone: "as-is",
    format: "plain-text",
    length: "as-is",
    sharedContext:
      "Rewrite academic prose for clarity and natural scholarly voice. Preserve the meaning, claims, uncertainty, citations, numbers, equations, names, and paragraph structure. Do not invent, remove, or strengthen evidence. Return only the rewritten prose.",
    monitor: (monitor) => {
      monitor.addEventListener("downloadprogress", (event) => {
        const loaded = (event as Event & { loaded?: number }).loaded;
        if (typeof loaded === "number") onProgress?.(Math.round(loaded * 100));
      });
    },
  });

  try {
    return (await session.rewrite(text, {
      context:
        "Keep all academic entities exactly intact. Improve flow without trying to evade detection or conceal authorship. Preserve inline citations and mathematical notation.",
    })).trim();
  } finally {
    session.destroy?.();
  }
}
