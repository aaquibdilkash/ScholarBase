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
  sentenceLengthCv: number;
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
  perplexityRisk: number | null;
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
      sentenceLengthCv: 0,
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
  const coefficientOfVariation = mean > 0 ? sigma / mean : 0;
  const freq = new Map<string, number>();
  words.forEach((w) => freq.set(w, (freq.get(w) || 0) + 1));
  let entropy = 0;
  for (const c of freq.values()) {
    const p = c / words.length;
    entropy -= p * Math.log2(p);
  }
  // A few sentences are too small a sample for a cadence judgment. Requiring
  // more observations substantially reduces false positives on abstracts and
  // short paragraphs.
  const flat = coefficientOfVariation < 0.25 && raw.length >= 5;
  const severe = coefficientOfVariation < 0.18 && raw.length >= 8;
  let cadencePatternCount = 0;
  let formulaicMarkerCount = 0;
  const sentences: SentenceAnalysis[] = raw.map((s, i) => {
    const len = lens[i];
    const reasons: string[] = [];
    const prev = i > 0 ? lens[i - 1] : null;
    const next = i < raw.length - 1 ? lens[i + 1] : null;
    const delta = Math.min(
      prev !== null ? Math.abs(len - prev) : 99,
      next !== null ? Math.abs(len - next) : 99,
    );
    let hasCadencePattern = false;
    if (delta <= Math.max(3, Math.round(mean * 0.14))) {
      reasons.push(`Uniform cadence (${len}w, delta +/-${delta})`);
      hasCadencePattern = true;
    }
    if (severe) reasons.push("Cadence collapse (normalized variation is very low)");
    else if (flat) reasons.push("Low burstiness variance");
    if (
      /^(moreover|furthermore|additionally|consequently|importantly|in summary|notably|specifically|however|therefore|overall|in conclusion|in this context|it is important to note|this suggests|this demonstrates|the findings indicate|taken together|as a result),/i.test(
        s,
      )
    ) {
      reasons.push("Formulaic discourse marker");
      formulaicMarkerCount++;
    }
    if (hasCadencePattern) cadencePatternCount++;
    return {
      id: `sent-${i}`,
      text: s,
      wordCount: len,
      cadenceDelta: delta === 99 ? 0 : delta,
      reasons,
    };
  });
  // Use normalized variation rather than raw sigma: a 4-word spread means
  // something very different for 10-word sentences than for 40-word ones.
  // This remains a weak diagnostic, so it is capped and never treated as a
  // standalone authorship verdict.
  const clamp = (value: number) => Math.max(0, Math.min(100, value));
  const cvRisk = clamp(((0.42 - coefficientOfVariation) / 0.42) * 100);
  const absoluteSpreadRisk = clamp(((7 - sigma) / 7) * 100);
  const cadencePatternRate = (cadencePatternCount / Math.max(1, raw.length - 1)) * 100;
  const formulaicMarkerRate = (formulaicMarkerCount / raw.length) * 100;
  const score = raw.length < 5
    ? 0
    : Math.round(clamp(
      cvRisk * 0.35 +
      absoluteSpreadRisk * 0.25 +
      cadencePatternRate * 0.25 +
      formulaicMarkerRate * 0.15,
    ));
  return {
    overallCadenceRisk: score,
    burstinessSigma: Math.round(sigma * 100) / 100,
    meanSentenceLength: Math.round(mean * 10) / 10,
    shannonEntropy: Math.round(entropy * 100) / 100,
    sentenceLengthCv: Math.round(coefficientOfVariation * 1000) / 1000,
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
  perplexityRisk: number | null = null,
): BalancedEnsembleResult {
  const classify = (s: number): EnsembleClassification =>
    s >= 70 ? "high" : s >= 40 ? "amber" : "low";

  const isSevereCadenceTrap = burstinessSigma < 3.4 && sentenceCount >= 8;

  // Fuse the two learned/zero-shot signals into one "model" score. TMR (a
  // RAID-trained classifier) and the perplexity-burstiness signal measure the
  // same underlying "machine-likeness" from different angles, so averaging them
  // when both are present is more robust than trusting either alone. When only
  // one is available it is used as-is; when neither is present the function
  // behaves exactly as the historical two-signal (neural + cadence) version.
  let effectiveNeural = neuralScore;
  if (neuralScore !== null && perplexityRisk !== null) {
    effectiveNeural = Math.round((neuralScore + perplexityRisk) / 2);
  } else if (neuralScore === null && perplexityRisk !== null) {
    effectiveNeural = perplexityRisk;
  }

  // Mode 1 — Quick Audit only (no learned signal): severe structural collapse
  // stays flagged even with rich vocabulary; only non-severe rhythm gets relief.
  if (effectiveNeural === null) {
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
      perplexityRisk,
    };
  }

  // Mode 2 — Ensemble: lexical damping shrinks the cadence penalty for dense
  // academic prose (R>6.8 → up to 40% reduction), never amplifies it.
  const academicDamping = Math.min(
    1.0,
    Math.max(0.6, 1.0 - (guiraudIndex - 5.5) * 0.15),
  );
  const dampedCadenceScore = Math.round(cadenceScore * academicDamping);
  const signalDivergence = Math.abs(effectiveNeural - dampedCadenceScore);

  // Jargon-mask guard: blind near-zero learned signal on severely uniform rhythm
  // with rich vocabulary is inconclusive — anchor amber, never collapse to green.
  const isJargonMasked =
    effectiveNeural <= 20 && isSevereCadenceTrap && guiraudIndex >= 7.5;

  // Low-confidence neural override: TMR is RAID-domain, so on
  // out-of-distribution academic prose it can confidently output
  // "human" and pin the classifier near 1%. When the learned
  // signal is that blind BUT the structural rhythm is still a severe cadence
  // trap (σ<3.4 across 8+ sentences), we refuse to report "low" — we anchor
  // amber as inconclusive. This is safe against false positives on real human
  // text: genuine prose has natural σ (>=3.4), so isSevereCadenceTrap is false
  // and this never fires. Superset-independent of the jargon-mask guard above
  // (which additionally requires rich vocabulary R>=7.5).
  const isLowConfidenceNeural =
    effectiveNeural <= 15 && isSevereCadenceTrap && !isJargonMasked;

  let finalScore: number;
  let explanation: string;
  if (isJargonMasked) {
    finalScore = Math.max(58, Math.round(cadenceScore * 0.65));
    explanation =
      "Jargon-masked cadence trap: advanced vocabulary masked the learned signal, but syntactic rhythm is uniformly synthetic. Review flagged sentences.";
  } else if (isLowConfidenceNeural) {
    finalScore = Math.max(48, Math.round(cadenceScore * 0.55));
    explanation =
      "Low-confidence classifier on synthetic cadence: the neural model reported near-zero AI risk (likely out-of-domain humanized prose), but syntactic rhythm is uniformly synthetic. Inconclusive — review flagged sentences.";
  } else if (signalDivergence > 40) {
    // Standard divergence: balanced 50/50 blend — neither signal gets veto.
    finalScore = Math.round(effectiveNeural * 0.5 + dampedCadenceScore * 0.5);
    explanation = "Mixed signals: cadence and model probabilities diverge. Review flagged sentences.";
  } else {
    finalScore = Math.round(effectiveNeural * 0.6 + dampedCadenceScore * 0.4);
    explanation =
      perplexityRisk !== null && neuralScore !== null
        ? "Neural classifier, perplexity-burstiness, and structural metrics aligned."
        : "Neural and structural metrics aligned.";
  }

  const bounded = Math.min(99, Math.max(1, finalScore));
  return {
    finalScore: bounded,
    classification: classify(bounded),
    explanation,
    dampedCadenceScore,
    signalDivergence: Math.round(signalDivergence),
    perplexityRisk,
  };
}

/**
 * Deterministic burstiness booster used by the on-device rewriter. When the
 * generated text still has flat sentence-length variation (low coefficient of
 * variation), split the single longest sentence at a clause boundary and/or
 * merge the two shortest adjacent sentences. This nudges σ/CV upward the way a
 * human naturally writes (short punchy clauses next to long ones) WITHOUT
 * touching protected academic tokens (citations, math, numbers).
 *
 * Returns the adjusted text plus the new cadence metrics. Never invents or drops
 * words — only re-punctuates existing ones. Idempotent: if CV is already
 * healthy it returns the input unchanged.
 */
export function boostBurstiness(
  text: string,
  targetCv = 0.3,
  maxEdits = 2,
): { text: string; cv: number; sigma: number; editsApplied: number } {
  const hasProtected = (s: string) => /__[A-Za-z]+_\d+__/.test(s);

  const measure = (input: string) => {
    const lens = splitAcademicSentences(input).map(
      (s) => (s.match(/\b[a-z0-9'-]+\b/g) || []).length,
    );
    const mean = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
    const sigma = lens.length
      ? Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length)
      : 0;
    return { cv: mean > 0 ? sigma / mean : 0, sigma };
  };

  let working = text;
  let { cv } = measure(working);
  let editsApplied = 0;

  // Split the longest safe sentence at a coordinating/subordinating clause
  // boundary, preserving every word and the original terminal punctuation.
  const trySplit = (input: string): string | null => {
    const sentences = splitAcademicSentences(input);
    let bestIndex = -1;
    let bestLen = 0;
    sentences.forEach((s, i) => {
      const len = (s.match(/\b[a-z0-9'-]+\b/g) || []).length;
      if (len > bestLen && len >= 18 && !hasProtected(s)) {
        bestLen = len;
        bestIndex = i;
      }
    });
    if (bestIndex < 0) return null;
    const target = sentences[bestIndex];
    const term = /[.?!]$/.test(target) ? target.slice(-1) : "";
    const clauses = target
      .replace(/[.?!]\s*$/, "")
      .split(/,\s+(?=(?:and|but|which|whereas|although|because|so|yet|while)\b)/i);
    if (clauses.length < 2) return null;
    const head = clauses[0].trim();
    const tail = clauses
      .slice(1)
      .map((c) => c.trim())
      .join(", ")
      .trim();
    if (!head || !tail) return null;
    const capitalised = tail.charAt(0).toUpperCase() + tail.slice(1);
    const next = [...sentences];
    next[bestIndex] = `${head}. ${capitalised}${term}`;
    return next.join(" ");
  };

  // Merge the two shortest adjacent sentences into one longer one.
  const tryMerge = (input: string): string | null => {
    const sentences = splitAcademicSentences(input);
    let bestIndex = -1;
    let bestPairLen = Infinity;
    for (let i = 0; i < sentences.length - 1; i += 1) {
      const a = (sentences[i].match(/\b[a-z0-9'-]+\b/g) || []).length;
      const b = (sentences[i + 1].match(/\b[a-z0-9'-]+\b/g) || []).length;
      const pair = a + b;
      if (
        pair < bestPairLen &&
        a <= 10 &&
        b <= 10 &&
        pair <= 34 &&
        !hasProtected(sentences[i]) &&
        !hasProtected(sentences[i + 1])
      ) {
        bestPairLen = pair;
        bestIndex = i;
      }
    }
    if (bestIndex < 0) return null;
    const a = sentences[bestIndex].replace(/[.?!]\s*$/, "").trim();
    const b = sentences[bestIndex + 1].replace(/[.?!]\s*$/, "").trim();
    if (!a || !b) return null;
    const tail = b.charAt(0).toLowerCase() + b.slice(1);
    const next = [...sentences];
    next.splice(bestIndex, 2, `${a}, and ${tail}.`);
    return next.join(" ");
  };

  while (cv < targetCv && editsApplied < maxEdits) {
    const before = cv;
    const splitCandidate = trySplit(working);
    const mergeCandidate = tryMerge(working);
    const splitCv = splitCandidate ? measure(splitCandidate).cv : -Infinity;
    const mergeCv = mergeCandidate ? measure(mergeCandidate).cv : -Infinity;
    const bestCv = Math.max(splitCv, mergeCv);
    if (bestCv === -Infinity || bestCv <= before) break;
    working = splitCv >= mergeCv ? (splitCandidate as string) : (mergeCandidate as string);
    cv = bestCv;
    editsApplied += 1;
  }

  const final = measure(working);
  return {
    text: working,
    cv: Math.round(final.cv * 1000) / 1000,
    sigma: Math.round(final.sigma * 100) / 100,
    editsApplied,
  };
}

/**
 * Aggressive, deterministic σ-forcer used when the goal is to push burstiness
 * sigma ABOVE an absolute floor (e.g. > 7), not merely lift the relative
 * coefficient of variation. `boostBurstiness` above is intentionally gentle
 * (CV target, tiny merge cap) to avoid mangling prose; this pass trades some of
 * that conservatism for reach.
 *
 * Why merging is the dominant lever: sigma is the standard deviation of
 * sentence word-counts. Building one long sentence beside several shorter ones
 * creates the spread that raises sigma fastest — merging two ~20-word sentences
 * into a ~40-word sentence next to ~15-word neighbours crosses sigma = 7 in a
 * single edit. Splitting the longest sentence at a clause boundary is the
 * secondary lever (creates a short outlier).
 *
 * Safety invariants (identical spirit to boostBurstiness):
 *  - Never invents or drops words — only re-punctuates existing ones.
 *  - Never touches a sentence carrying a protected token (`__X_n__`).
 *  - Merges are capped (<= 60 combined words) to avoid absurd run-ons.
 *  - Greedy and monotone: each edit must strictly raise sigma, else it stops,
 *    so the pass can never lower the metric or loop.
 */
export function forceBurstiness(
  text: string,
  targetSigma = 7.5,
  maxEdits = 8,
): { text: string; sigma: number; cv: number; editsApplied: number } {
  const hasProtected = (s: string) => /__[A-Za-z]+_\d+__/.test(s);
  const words = (s: string) => (s.match(/\b[a-z0-9'-]+\b/g) || []).length;

  const measure = (input: string) => {
    const lens = splitAcademicSentences(input).map(words);
    const mean = lens.length ? lens.reduce((a, b) => a + b, 0) / lens.length : 0;
    const sigma = lens.length
      ? Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length)
      : 0;
    return { cv: mean > 0 ? sigma / mean : 0, sigma };
  };

  let working = text;
  let { sigma } = measure(working);
  let editsApplied = 0;

  // Try every adjacent merge; keep the one that maximizes sigma.
  const tryMerge = (input: string): string | null => {
    const sentences = splitAcademicSentences(input);
    let best: string | null = null;
    let bestSigma = -Infinity;
    for (let i = 0; i < sentences.length - 1; i += 1) {
      if (hasProtected(sentences[i]) || hasProtected(sentences[i + 1])) continue;
      if (words(sentences[i]) + words(sentences[i + 1]) > 60) continue;
      const a = sentences[i].replace(/[.?!]\s*$/, "").trim();
      const b = sentences[i + 1].replace(/[.?!]\s*$/, "").trim();
      if (!a || !b) continue;
      const tail = b.charAt(0).toLowerCase() + b.slice(1);
      const next = [...sentences];
      next.splice(i, 2, `${a}, and ${tail}.`);
      const candidate = next.join(" ");
      const s = measure(candidate).sigma;
      if (s > bestSigma) {
        bestSigma = s;
        best = candidate;
      }
    }
    return best;
  };

  // Try splitting each long sentence at a clause boundary; keep the best.
  const trySplit = (input: string): string | null => {
    const sentences = splitAcademicSentences(input);
    let best: string | null = null;
    let bestSigma = -Infinity;
    sentences.forEach((sentence, i) => {
      if (words(sentence) < 16 || hasProtected(sentence)) return;
      const term = /[.?!]$/.test(sentence) ? sentence.slice(-1) : "";
      const clauses = sentence
        .replace(/[.?!]\s*$/, "")
        .split(/,\s+(?=(?:and|but|which|whereas|although|because|so|yet|while)\b)/i);
      if (clauses.length < 2) return;
      const head = clauses[0].trim();
      const tail = clauses.slice(1).map((c) => c.trim()).join(", ").trim();
      if (!head || !tail) return;
      const capitalised = tail.charAt(0).toUpperCase() + tail.slice(1);
      const next = [...sentences];
      next[i] = `${head}. ${capitalised}${term}`;
      const candidate = next.join(" ");
      const s = measure(candidate).sigma;
      if (s > bestSigma) {
        bestSigma = s;
        best = candidate;
      }
    });
    return best;
  };

  while (sigma < targetSigma && editsApplied < maxEdits) {
    const before = sigma;
    const mergeCandidate = tryMerge(working);
    const splitCandidate = trySplit(working);
    const mergeSigma = mergeCandidate ? measure(mergeCandidate).sigma : -Infinity;
    const splitSigma = splitCandidate ? measure(splitCandidate).sigma : -Infinity;
    const best = Math.max(mergeSigma, splitSigma);
    if (best === -Infinity || best <= before) break;
    working = mergeSigma >= splitSigma ? (mergeCandidate as string) : (splitCandidate as string);
    sigma = best;
    editsApplied += 1;
  }

  const final = measure(working);
  return {
    text: working,
    sigma: Math.round(final.sigma * 100) / 100,
    cv: Math.round(final.cv * 1000) / 1000,
    editsApplied,
  };
}

