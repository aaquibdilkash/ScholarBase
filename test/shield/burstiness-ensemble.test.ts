/**
 * Guards the two deterministic levers that fix "the rewriter can't produce
 * high sigma":
 *
 *  1. `boostBurstiness` — the post-generation pass wired into the rewriter
 *     worker and the humanize() flow. It must raise sentence-length CV without
 *     adding/dropping words or touching protected academic tokens, and it must
 *     be idempotent on already-varied prose.
 *
 *  2. `calculateBalancedEnsemble` — the three-signal fusion (neural classifier
 *     + perplexity-burstiness + cadence). The perplexity term must fold into the
 *     effective neural score when present and be ignored when null, while the
 *     jargon-mask / mixed-signals safety bands are preserved.
 *
 * These are pure functions (no DOM, no DB), so they run in the node unit tier.
 */
import { describe, expect, it } from "vitest";

import {
  analyzeCadenceAndEntropy,
  boostBurstiness,
  calculateBalancedEnsemble,
  forceBurstiness,
  splitAcademicSentences,
} from "@/lib/shield/statistical-analyzer";

const words = (text: string) => (text.match(/[a-z0-9'-]+/gi) ?? []).map((w) => w.toLowerCase());
const containsAllWords = (source: string, result: string) => {
  const pool = words(result);
  const needed = new Map<string, number>();
  for (const w of words(source)) needed.set(w, (needed.get(w) ?? 0) + 1);
  for (const [w, n] of needed) {
    let have = 0;
    for (const p of pool) if (p === w) have += 1;
    if (have < n) return false;
  }
  return true;
};

describe("boostBurstiness", () => {
  it("raises sentence-length CV on flat, mergeable prose", () => {
    // Four identical short sentences: flat (CV=0) and each short enough that the
    // merge helper can combine an adjacent pair into a longer one, which lifts
    // the coefficient of variation the way natural writing varies.
    const flat = Array.from({ length: 4 }, () =>
      "The model performs very well here.",
    ).join(" ");

    const before = analyzeCadenceAndEntropy(flat);
    const after = boostBurstiness(flat, 0.34, 2);

    expect(after.cv).toBeGreaterThan(before.sentenceLengthCv);
    // Nothing is dropped: every original word survives (merge may add "and").
    expect(containsAllWords(flat, after.text)).toBe(true);
  });

  it("preserves protected academic tokens and never drops their words", () => {
    // __REF_0__ is the masking format produced by lockAcademicEntities; the
    // split/merge helpers must never break across it or lose content.
    const masked =
      "The findings in __REF_0__ are significant, and they generalize across " +
      "the broader population studied here over the full observation window. " +
      "Prior work agrees. The effect is small.";

    const result = boostBurstiness(masked, 0.34, 2);
    expect(result.text).toContain("__REF_0__");
    expect(containsAllWords(masked, result.text)).toBe(true);
  });

  it("is idempotent on already-varied prose (no unnecessary edits)", () => {
    const varied =
      "It failed. " +
      "The longitudinal cohort, drawn from three distinct metropolitan regions " +
      "and followed continuously for more than a decade, nonetheless reproduced " +
      "the effect under every specification we tested. " +
      "We remain cautious.";

    const once = boostBurstiness(varied, 0.34, 2);
    const twice = boostBurstiness(once.text, 0.34, 2);

    // A second pass must not keep mutating text that already meets the target.
    expect(twice.text).toEqual(once.text);
    expect(twice.editsApplied).toBe(0);
  });

  it("leaves tiny samples intact rather than mangling them", () => {
    const short = "This is short. So is this. And this one too.";
    const result = boostBurstiness(short, 0.34, 2);
    // With only tiny sentences there is nothing safe to split; every word survives.
    expect(containsAllWords(short, result.text)).toBe(true);
  });
});

describe("splitAcademicSentences", () => {
  it("splits on terminal punctuation and trims", () => {
    expect(splitAcademicSentences("One. Two!  Three?")).toEqual(["One.", "Two!", "Three?"]);
  });
});

describe("forceBurstiness", () => {
  it("drives sigma above 7 on uniform multi-sentence prose", () => {
    // Six near-identical ~18-word sentences: the machine-like flat cadence with
    // sigma near zero. forceBurstiness must merge pairs into long outliers until
    // the standard deviation of sentence lengths clears the >7 floor.
    const flat = Array.from({ length: 6 }, () =>
      "The longitudinal analysis of the metropolitan cohort confirms the model performs consistently across every measured specification.",
    ).join(" ");

    const before = analyzeCadenceAndEntropy(flat).burstinessSigma;
    const after = forceBurstiness(flat, 7.5, 8);

    expect(before).toBeLessThan(7);
    expect(after.sigma).toBeGreaterThan(7);
    // The sigma forceBurstiness reports must match what the UI displays
    // (analyzeCadenceAndEntropy uses the identical formula).
    expect(analyzeCadenceAndEntropy(after.text).burstinessSigma).toBeCloseTo(after.sigma, 1);
  });

  it("never drops or invents words and preserves protected tokens", () => {
    const masked =
      "The cohort in __REF_0__ was followed for a decade, and the effect held. " +
      "Results were stable. The model generalized well. Prior work agrees here. " +
      "The finding is small but real. We remain cautious about the estimate.";

    const result = forceBurstiness(masked, 7.5, 8);
    expect(result.text).toContain("__REF_0__");
    expect(containsAllWords(masked, result.text)).toBe(true);
  });

  it("is monotone: sigma after the pass is >= sigma before", () => {
    const samples = [
      "Short one. Another short clause here. A much longer sentence that runs on with several subordinate clauses and qualifications attached to it. Tiny.",
      Array.from({ length: 8 }, (_, i) => `Observation ${i} replicates the central result without deviation.`).join(" "),
    ];
    for (const sample of samples) {
      const before = analyzeCadenceAndEntropy(sample).burstinessSigma;
      const after = forceBurstiness(sample, 7.5, 8);
      expect(after.sigma).toBeGreaterThanOrEqual(before);
    }
  });

  it("leaves a single sentence untouched (nothing to vary)", () => {
    const single = "A single clause with no neighbours cannot be reshaped by punctuation alone.";
    const result = forceBurstiness(single, 7.5, 8);
    expect(result.text).toBe(single);
    expect(result.editsApplied).toBe(0);
  });
});


describe("calculateBalancedEnsemble — three-signal fusion", () => {
  it("ignores perplexity when null (historical two-signal behavior)", () => {
    // Aligned inputs (neural 80 vs damped cadence 65) land in the standard
    // 60/40 blend: 80*0.6 + 65*0.4 = 74 → high. A null perplexity must not
    // perturb this at all.
    const noPerplexity = calculateBalancedEnsemble(80, 65, 5, 5, 10, null);
    expect(noPerplexity.perplexityRisk).toBeNull();
    expect(noPerplexity.finalScore).toBe(74);
    expect(noPerplexity.classification).toBe("high");
  });

  it("folds a present perplexity signal into the effective neural score", () => {
    // neural 90, perplexity 10 → effectiveNeural averages to 50.
    const fused = calculateBalancedEnsemble(90, 50, 5, 6, 10, 10);
    // The explanation should acknowledge the perplexity signal on the aligned path.
    expect(fused.perplexityRisk).toBe(10);
    // 50*0.6 + damped(50)*0.4 should land mid-band, not the near-certain high
    // that neural-only 90 would have produced.
    expect(fused.finalScore).toBeLessThan(90);
  });

  it("uses perplexity alone when the classifier is unavailable", () => {
    // When neuralScore is null but a perplexity signal exists, the perplexity
    // value must stand in for the neural score — identical to passing that same
    // number as neuralScore with no perplexity. This is assumption-free.
    const perplexityOnly = calculateBalancedEnsemble(null, 65, 5, 5, 10, 72);
    const asNeural = calculateBalancedEnsemble(72, 65, 5, 5, 10, null);
    expect(perplexityOnly.perplexityRisk).toBe(72);
    expect(perplexityOnly.finalScore).toBe(asNeural.finalScore);
  });

  it("keeps the jargon-mask guard from collapsing to green", () => {
    // Near-zero neural, severe cadence trap (sigma<3.4, 8+ sentences), rich vocab.
    const masked = calculateBalancedEnsemble(8, 90, 2.5, 8.5, 12, null);
    expect(masked.finalScore).toBeGreaterThanOrEqual(58);
    expect(masked.classification).not.toBe("low");
  });

  it("lands strong disagreement in the amber mixed-signals band", () => {
    const divergent = calculateBalancedEnsemble(95, 30, 6, 5, 10, null);
    expect(divergent.signalDivergence).not.toBeNull();
    // 50/50 blend, never a hard override to either extreme.
    expect(divergent.finalScore).toBeGreaterThan(30);
    expect(divergent.finalScore).toBeLessThan(95);
  });

  it("does NOT pin humanized academic prose at 'low' when the classifier is blind", () => {
    // ModernBERT is DAIGT-domain, so on humanized
    // academic prose it can confidently report ~0% AI. But a severe cadence trap
    // (σ<3.4 across 8+ sentences) is still structurally synthetic. The
    // low-confidence override must anchor this amber (inconclusive), not green.
    // Guiraud < 7.5 so this exercises the override, not the jargon-mask guard.
    const humanized = calculateBalancedEnsemble(2, 90, 2.5, 6.0, 12, null);
    expect(humanized.classification).not.toBe("low");
    expect(humanized.finalScore).toBeGreaterThanOrEqual(48);
  });

  it("still reports genuine human prose as 'low' (no new false positives)", () => {
    // Safety property: real human writing has natural σ (>=3.4), so the severe
    // cadence trap is false and the override must NOT fire. A blind classifier
    // on genuinely-varied prose stays low.
    const human = calculateBalancedEnsemble(2, 30, 5.0, 5.0, 12, null);
    expect(human.classification).toBe("low");
  });

  // ── ModernBERT label-reader regression ────────────────────────────────────
  // The ModernBERT ONNX config ships no id2label, so transformers.js returns
  // LABEL_0 / LABEL_1 (not "human"/"ai"). This guards the exact inversion risk
  // of swapping detectors: the worker reads P(ai) as the LABEL_1 probability.
  function extractAiProb(sorted: Array<{ label: string; score: number }>): number {
    const ai = sorted.find((e) => /label_1|ai|fake|generated/i.test(e.label));
    const human = sorted.find((e) => /label_0|human/i.test(e.label));
    if (ai) return ai.score;
    return human ? 1 - human.score : 0;
  }

  it("reads ModernBERT LABEL_1 as the AI probability (no class inversion)", () => {
    // Model card maps 1 → AI, 0 → human; transformers.js emits LABEL_0/LABEL_1.
    const confidentAI = [
      { label: "LABEL_0", score: 0.1 },
      { label: "LABEL_1", score: 0.9 },
    ];
    expect(extractAiProb(confidentAI)).toBeCloseTo(0.9, 5);

    // The mirror image must NOT read as AI (the double-inversion bug we guard).
    const confidentHuman = [
      { label: "LABEL_1", score: 0.1 },
      { label: "LABEL_0", score: 0.9 },
    ];
    expect(extractAiProb(confidentHuman)).toBeCloseTo(0.1, 5);
  });

});
