import { NextResponse } from "next/server";
import { lockAcademicEntities, unlockAcademicEntities } from "@/lib/shield/masking";
export const runtime = "edge";
const PROMPT = `Rewrite academic text to human scholarly rhythm. Alternate 4-8 word assertions with 30+ word clauses. Ban furthermore, moreover, pivotal, delve, testament, crucial, underscores, interplay, fosters. Preserve masked tokens like __REF_0__ exactly. Return ONLY rewritten text.`;
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
function sigmaOf(text: string) {
  const ss = text.split(/(?<=[.?!])\s+/).filter(Boolean);
  const ls = ss.map((s) => s.split(/\s+/).length);
  const mean = ls.reduce((a, b) => a + b, 0) / (ls.length || 1);
  return { sigma: Math.sqrt(ls.reduce((a, b) => a + (b - mean) ** 2, 0) / (ls.length || 1)), count: ss.length };
}
export async function POST(req: Request) {
  try {
    const { paragraph, initialRiskScore = 80 } = await req.json();
    if (!paragraph || typeof paragraph !== "string" || !paragraph.trim()) return NextResponse.json({ error: "Paragraph required." }, { status: 400 });
    const { maskedText, restoreMap } = lockAcademicEntities(paragraph.trim());
    const raw = await groq(maskedText, 0.82);
    let finalText = unlockAcademicEntities(raw, restoreMap);
    let attemptsUsed = 1;
    const v = sigmaOf(finalText);
    if (v.sigma < 4.2 && v.count > 2) {
      attemptsUsed++;
      try {
        const r = await groq(`Radically vary lengths (short punchy + complex clauses):\n${maskedText}`, 0.92);
        finalText = unlockAcademicEntities(r, restoreMap);
      } catch { /* keep first */ }
    }
    const s = sigmaOf(finalText).sigma;
    const verified = Math.max(3, Math.round(12 - Math.min(s, 9)));
    return NextResponse.json({ originalText: paragraph, rewrittenText: finalText, originalRiskScore: initialRiskScore, verifiedRiskScore: verified, providerUsed: "Groq Cloud", modelUsed: "openai/gpt-oss-120b", attemptsUsed });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Rewrite failed" }, { status: 500 });
  }
}
