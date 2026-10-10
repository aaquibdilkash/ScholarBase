import { NextResponse } from "next/server";
import { z } from "zod";
import { lockAcademicEntities, unlockAcademicEntities } from "@/lib/shield/masking";
import { createClient } from "@/utils/supabase/server";
import { checkRateLimit, RATE_LIMIT_DEGRADED_ERROR, RATE_LIMIT_ERROR } from "@/lib/rate-limit";
// This route uses the shared rate-limit helper, which intentionally uses
// Node's crypto implementation for stable hashed keys.
export const runtime = "nodejs";
// Server-side floor mirroring the UI (ShieldStudio MIN_REWRITE_WORDS): rewriting
// needs at least a few sentences to vary cadence, and this is the one paid path
// (Groq), so tiny inputs are refused here too — the UI check is not trusted.
const MIN_REWRITE_WORDS = 40;
const PROMPT = `Rewrite academic prose for clarity, coherence, and the author's natural scholarly voice. Preserve the meaning, claims, uncertainty, citations, numbers, equations, names, and paragraph structure. Do not invent evidence, remove caveats, or attempt to conceal authorship or evade AI detection. Preserve masked tokens like __REF_0__ exactly. Return ONLY the rewritten prose.`;
async function groq(prompt: string, temperature: number) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("GROQ_API_KEY not configured");
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", { method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: "openai/gpt-oss-120b", messages: [{ role: "system", content: PROMPT }, { role: "user", content: prompt }], temperature }) });
  if (!res.ok) { const t = await res.text(); throw new Error(`Groq error (${res.status}): ${t.slice(0, 400)}`); }
  const data = await res.json();
  const out = data?.choices?.[0]?.message?.content;
  if (!out) throw new Error("Empty Groq response");
  return String(out).trim();
}
const requestSchema = z.object({ paragraph: z.string().trim().min(1).max(30_000).refine((v) => v.split(/\s+/).filter(Boolean).length >= MIN_REWRITE_WORDS, { message: `Provide at least ${MIN_REWRITE_WORDS} words to rewrite.` }) });

export async function POST(req: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const limit = await checkRateLimit({ namespace: "shield:rewrite", key: user.id, limit: 10, window: "10 m", onDegraded: "closed" });
    if (!limit.allowed) {
      return NextResponse.json({ error: limit.degraded ? RATE_LIMIT_DEGRADED_ERROR : RATE_LIMIT_ERROR }, { status: limit.degraded ? 503 : 429 });
    }
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) return NextResponse.json({ error: `Provide at least ${MIN_REWRITE_WORDS} words and no more than 30,000 characters.` }, { status: 400 });
    const { paragraph } = parsed.data;
    const { maskedText, restoreMap } = lockAcademicEntities(paragraph.trim());
    const raw = await groq(maskedText, 0.82);
    const finalText = unlockAcademicEntities(raw, restoreMap);
    const attemptsUsed = 1;
    return NextResponse.json({ originalText: paragraph, rewrittenText: finalText, providerUsed: "Groq Cloud", modelUsed: "openai/gpt-oss-120b", attemptsUsed });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Rewrite failed" }, { status: 500 });
  }
}
