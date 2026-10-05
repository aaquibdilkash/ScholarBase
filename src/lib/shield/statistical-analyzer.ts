// src/lib/shield/statistical-analyzer.ts
// Deterministic cadence + entropy profiler. Runs in <5ms, zero downloads.
export type RiskTier = "high" | "amber" | "low";
export interface SentenceAnalysis {
  id: string;
  text: string;
  wordCount: number;
  cadenceDelta: number;
  reasons: string[];
}
export interface StatisticalProfile {
  overallCadenceRisk: number;
  burstinessSigma: number;
  meanSentenceLength: number;
  shannonEntropy: number;
  guiraudIndex: number;
  uniqueWords: number;
  totalWords: number;
  sentences: SentenceAnalysis[];
}

export type EnsembleClassification = "high" | "amber" | "low";

export interface BalancedEnsembleResult {
  finalScore: number;
  classification: EnsembleClassification;
  explanation: string;
  dampedCadenceScore: number;
  signalDivergence: number | null;
}

/** Guiraud's Index R = V / sqrt(N): lexical richness / domain-depth proxy. */
export function computeLexicalRichness(words: string[]): number {
  if (!words.length) return 0;
  const unique = new Set(words.map((w) => w.toLowerCase()));
  return Math.round((unique.size / Math.sqrt(words.length)) * 100) / 100;
}

/**
 * Balanced fusion — NEVER a hard override.
 * - Quick-only (neural null): lightly damp cadence when vocabulary is rich.
 * - Ensemble: neural 60% + damped cadence 40%; when signals diverge (>45),
 *   weight neural 65% + damped cadence 35% and return amber "mixed signals".
 */
export function splitAcademicSentences(text: string): string[] {
  return text.split(/(?<=[.?!])\s+/).map((s) => s.trim()).filter(Boolean);
}
export function analyzeCadenceAndEntropy(text: string): StatisticalProfile {
  const raw = splitAcademicSentences(text);
  if (!raw.length) {
    return {
      overallCadenceRisk: 0,
      burstinessSigma: 0,
      meanSentenceLength: 0,
      shannonEntropy: 0,
      guiraudIndex: 0,
      uniqueWords: 0,
      totalWords: 0,
      sentences: [],
    };
  }
  const words = text.toLowerCase().match(/\b[a-z0-9'-]+\b/g) || [];
  const uniqueWords = new Set(words).size;
  const guiraudIndex = computeLexicalRichness(words);
  const lens = raw.map((s) => (s.match(/\b[a-z0-9'-]+\b/g) || []).length);
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const sigma = Math.sqrt(
    lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length,
  );
  const freq = new Map<string, number>();
  words.forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
  let entropy = 0;
  for (const c of freq.values()) {
    const p = c / words.length;
    entropy -= p * Math.log2(p);
  }
  const flat = sigma < 4.2 && raw.length >= 3;
  const severe = sigma < 3.5 && raw.length >= 5;
  let flagged = 0;
  const sentences: SentenceAnalysis[] = raw.map((s, i) => {
    const len = lens[i];
    const reasons: string[] = [];
    const prev = i > 0 ? lens[i - 1] : null;
    const next = i < raw.length - 1 ? lens[i + 1] : null;
    const delta = Math.min(
      prev !== null ? Math.abs(len - prev) : 99,
      next !== null ? Math.abs(len - next) : 99,
    );
    if (len >= 12 && len <= 22 && delta <= 3) {
      reasons.push(`Uniform cadence (${len}w, delta +/-${delta})`);
    }
    if (severe) reasons.push("Cadence collapse (sigma < 3.5)");
    else if (flat) reasons.push("Low burstiness variance");
    if (
      /^(moreover|furthermore|additionally|consequently|importantly|in summary|notably|specifically),/i.test(
        s,
      )
    ) {
      reasons.push("Formulaic discourse marker");
    }
    if (reasons.length) flagged++;
    return {
      id: `sent-${i}`,
      text: s,
      wordCount: len,
      cadenceDelta: delta === 99 ? 0 : delta,
      reasons,
    };
  });
  let score = Math.round((flagged / raw.length) * 100);
  if (severe) score = Math.max(score, 92);
  else if (flat) score = Math.max(score, 75);
  return {
    overallCadenceRisk: score,
    burstinessSigma: Math.round(sigma * 100) / 100,
    meanSentenceLength: Math.round(mean * 10) / 10,
    shannonEntropy: Math.round(entropy * 100) / 100,
    guiraudIndex,
    uniqueWords,
    totalWords: words.length,
    sentences,
  };
}

/**
 * Institution-calibrated multi-signal fusion. Cadence can NEVER force 100% over a
 * low neural score — dense scholarly vocabulary damps the structure penalty,
 * and strong disagreement lands in an amber "mixed signals" band.
 *
 * Jargon-mask guard: when the neural model returns near-zero on text with a
 * severe cadence collapse (sigma<3.4, 5+ sentences) and rich vocabulary
 * (R>=7.5), the neural pass is treated as inconclusive (domain-masked) rather
 * than authoritative truth — the result anchors amber (58-65%), never green.
 */
export function calculateBalancedEnsemble(
  neuralScore: number | null,
  cadenceScore: number,
  burstinessSigma: number,
  guiraudIndex: number,
  sentenceCount = 0,
): BalancedEnsembleResult {
  const classify = (s: number): EnsembleClassification =>
    s >= 70 ? "high" : s >= 40 ? "amber" : "low";

  const isSevereCadenceTrap = burstinessSigma < 3.4 && sentenceCount >= 5;

  // Mode 1 — Quick Audit only: severe structural collapse stays flagged even
  // with rich vocabulary; only non-severe rhythm gets vocabulary relief.
  if (neuralScore === null) {
    const richnessDamping =
      guiraudIndex >= 8.0 && !isSevereCadenceTrap ? 0.8 : 1.0;
    const finalScore = Math.round(cadenceScore * richnessDamping);
    return {
      finalScore,
      classification: classify(finalScore),
      explanation:
        guiraudIndex >= 6.5
          ? "Cadence metric only — rich scholarly vocabulary applied as a damping factor. Run Deep Neural Scan for balanced validation."
          : "Cadence metric only. Run Deep Neural Scan for balanced validation.",
      dampedCadenceScore: finalScore,
      signalDivergence: null,
    };
  }

  // Mode 2 — Ensemble: lexical damping shrinks the cadence penalty for
  // dense academic prose (R>6.8 → up to 40% reduction), never amplifies it.
  const academicDamping = Math.min(
    1.0,
    Math.max(0.6, 1.0 - (guiraudIndex - 5.5) * 0.15),
  );
  const dampedCadenceScore = Math.round(cadenceScore * academicDamping);
  const signalDivergence = Math.abs(neuralScore - dampedCadenceScore);

  // Jargon-mask guard: blind near-zero neural on severely uniform rhythm with
  // rich vocabulary is inconclusive — anchor amber, never collapse to green.
  const isJargonMasked =
    neuralScore <= 20 && isSevereCadenceTrap && guiraudIndex >= 7.5;

  let finalScore: number;
  let explanation: string;
  if (isJargonMasked) {
    finalScore = Math.max(58, Math.round(cadenceScore * 0.65));
    explanation =
      "Jargon-masked cadence trap: advanced vocabulary masked the neural pass, but syntactic rhythm is uniformly synthetic. Review flagged sentences.";
  } else if (signalDivergence > 40) {
    // Standard divergence: balanced 50/50 blend — neither signal gets veto.
    finalScore = Math.round(neuralScore * 0.5 + dampedCadenceScore * 0.5);
    explanation =
      "Mixed signals: cadence and neural probabilities diverge. Review flagged sentences.";
  } else {
    finalScore = Math.round(neuralScore * 0.6 + dampedCadenceScore * 0.4);
    explanation = "Neural and structural metrics aligned.";
  }

  const bounded = Math.min(99, Math.max(1, finalScore));
  return {
    finalScore: bounded,
    classification: classify(bounded),
    explanation,
    dampedCadenceScore,
    signalDivergence: Math.round(signalDivergence),
  };
}
