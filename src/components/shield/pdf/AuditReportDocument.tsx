// src/components/shield/pdf/AuditReportDocument.tsx
// ScholarShield vector PDF: branded cover + diagnostic overview (cadence,
// neural, and balanced results reported separately) + highlighted transcript
// + audit-table appendix. Compiled 100% in-browser via @react-pdf/renderer —
// the paper never leaves the device.
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";
import type { StatisticalProfile } from "@/lib/shield/statistical-analyzer";

const C = {
  ink: "#0f172a",
  body: "#1e293b",
  slate: "#475569",
  muted: "#64748b",
  faint: "#94a3b8",
  line: "#e2e8f0",
  soft: "#f8fafc",
  zebra: "#f1f5f9",
  white: "#ffffff",
  blue: "#2563eb",
  blueSoft: "#eff6ff",
  rose: "#e11d48",
  roseSoft: "#fff1f2",
  amber: "#d97706",
  amberSoft: "#fffbeb",
  green: "#059669",
  greenSoft: "#ecfdf5",
};

// Same thresholds as calculateBalancedEnsemble's classify(): >=70 high, >=40 amber.
const riskColor = (s: number) => (s >= 70 ? C.rose : s >= 40 ? C.amber : C.green);
const riskSoft = (s: number) => (s >= 70 ? C.roseSoft : s >= 40 ? C.amberSoft : C.greenSoft);
const riskLabel = (s: number) => (s >= 70 ? "HIGH AI-LIKELIHOOD" : s >= 40 ? "MIXED SIGNALS" : "LOW AI-LIKELIHOOD");

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 44,
    paddingHorizontal: 48,
    fontSize: 9.5,
    color: C.body,
    // CSS-style multiplier: 1.5 x fontSize = ~14.25pt line box (safe).
    // NOTE: a unitless lineHeight is a RATIO in react-pdf — a value like 32
    // would mean 32 x 27pt = 864pt > page height and loops page-splitting
    // forever (diegomura/react-pdf#2884) — hangs "Generating PDF...".
    lineHeight: 1.5,
    backgroundColor: C.white,
  },
  // ---- Running chrome -------------------------------------------------------
  band: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 34,
    backgroundColor: C.ink,
    paddingHorizontal: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  bandText: { color: "#e2e8f0", fontSize: 7.5, letterSpacing: 1.4 },
  bandId: { color: C.faint, fontSize: 7.5, letterSpacing: 0.6 },
  bandPowered: { color: C.faint, fontSize: 6.5, letterSpacing: 0.4 },
  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    height: 30,
    paddingHorizontal: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: C.line,
    backgroundColor: C.white,
  },
  footerText: { fontSize: 7.5, color: C.faint },
  // ---- Cover ----------------------------------------------------------------
  eyebrow: { fontSize: 8, letterSpacing: 2.4, color: C.blue, fontWeight: "bold" },
  coverTitle: { fontSize: 27, fontWeight: "bold", color: C.ink, marginTop: 10, lineHeight: 1.2 },
  rule: { width: 56, height: 4, backgroundColor: C.blue, marginVertical: 14 },
  coverSubtitle: { fontSize: 11, color: C.slate, marginBottom: 26, maxWidth: "80%" },
  verdictCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 6,
    padding: 16,
    marginBottom: 24,
  },
  verdictScore: { fontSize: 40, fontWeight: "bold", width: 110, textAlign: "center", lineHeight: 1 },
  verdictDivider: { width: 1, height: 36, backgroundColor: C.line, marginHorizontal: 14 },
  verdictLabel: { fontSize: 10, fontWeight: "bold", letterSpacing: 1.2 },
  verdictHint: { fontSize: 8.5, color: C.muted, marginTop: 4 },
  // ---- Tables ---------------------------------------------------------------
  card: { borderWidth: 1, borderColor: C.line, borderRadius: 6, padding: 14, marginBottom: 16 },
  cardTitle: { fontSize: 10, fontWeight: "bold", color: C.ink, marginBottom: 4, letterSpacing: 0.4 },
  cardRule: { width: 26, height: 2, backgroundColor: C.blue, marginBottom: 10 },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: C.line,
  },
  metaRowAlt: { backgroundColor: C.soft },
  metaLabel: { fontSize: 8.5, color: C.muted },
  metaVal: { fontSize: 8.5, fontWeight: "bold", color: C.ink },
  headRow: { flexDirection: "row", backgroundColor: C.ink, padding: 7 },
  headCell: { color: C.white, fontSize: 7.5, fontWeight: "bold", letterSpacing: 0.5 },
  bodyRow: { flexDirection: "row", padding: 7, borderBottomWidth: 0.5, borderBottomColor: C.line },
  bodyRowAlt: { backgroundColor: C.soft },
  bodyRowVerdict: { backgroundColor: C.zebra },
  cell: { fontSize: 8, color: C.body },
  cellBold: { fontSize: 8, color: C.ink, fontWeight: "bold" },
  // ---- Verdict banner -------------------------------------------------------
  banner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
    marginBottom: 18,
  },
  bannerScore: { fontSize: 34, fontWeight: "bold", width: 96, textAlign: "center", lineHeight: 1 },
  bannerDivider: { width: 1, height: 30, marginHorizontal: 14, opacity: 0.3 },
  bannerLabel: { fontSize: 10, fontWeight: "bold", letterSpacing: 1 },
  bannerSub: { fontSize: 8.5, marginTop: 3 },
  noteBox: {
    backgroundColor: C.blueSoft,
    borderLeftWidth: 3,
    borderLeftColor: C.blue,
    padding: 10,
    marginBottom: 14,
    fontSize: 8,
    color: C.slate,
    lineHeight: 1.45,
  },
  sectionEyebrow: { fontSize: 7.5, letterSpacing: 2, color: C.blue, fontWeight: "bold", marginBottom: 3 },
  // ---- Branding --------------------------------------------------------------
  brandLockup: { flexDirection: "row", alignItems: "center", marginBottom: 16 },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 7,
    backgroundColor: "#020617",
    borderWidth: 0.5,
    borderColor: "#334155",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    flexShrink: 0,
    alignSelf: "center",
  },
  brandIconS: { color: "#ffffff", fontSize: 15, fontWeight: "bold", lineHeight: 1 },
  brandIconB: { color: "#3b82f6", fontSize: 15, fontWeight: "bold", lineHeight: 1 },
  brandText: { flexDirection: "column", justifyContent: "center" },
  brandName: { fontSize: 16, fontWeight: "bold", color: "#0f172a", letterSpacing: -0.3, lineHeight: 1.1 },
  brandNameAccent: { color: "#2563eb" },
  brandByline: { fontSize: 7.5, letterSpacing: 0.4, color: "#64748b", marginTop: 1.5, lineHeight: 1.2 },
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: C.ink, marginBottom: 12 },
  appendixDesc: { fontSize: 10, color: "#334155", lineHeight: 1.5, marginBottom: 14 },
  appendixLegendContainer: { flexDirection: "row", flexWrap: "wrap", backgroundColor: "#f8fafc", borderWidth: 0.5, borderColor: "#e2e8f0", borderRadius: 4, padding: 8, marginTop: 4, marginBottom: 10 },
  appendixLegendItem: { flexDirection: "row", alignItems: "center", marginRight: 8 },
  appendixLegendLabel: { fontSize: 9, fontWeight: "bold", color: "#1e293b", marginRight: 3 },
  appendixLegendValue: { fontSize: 9, color: "#334155" },
  legend: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  swatch: { width: 14, height: 9, backgroundColor: "#fee2e2", marginRight: 6, alignSelf: "center" },
  legendText: { fontSize: 9.5, color: "#1e293b", lineHeight: 1.35 },
  paragraph: { marginBottom: 10, textAlign: "justify" },
  flagged: { backgroundColor: "#fee2e2", color: "#991b1b", paddingTop: 1.5, paddingBottom: 1.5 },
  plain: { color: C.body },
});

export interface ReportProps {
  title: string;
  submissionId: string;
  timestamp: string;
  overallScore: number;
  statProfile: StatisticalProfile;
  neuralScore: number | null;
  fullText: string;
}

export function AuditReportDocument({ title, submissionId, timestamp, overallScore, statProfile, neuralScore, fullText }: ReportProps) {
  const wordCount = statProfile.totalWords || fullText.trim().split(/\s+/).filter(Boolean).length;
  const sentenceCount = statProfile.sentences.length;
  const transcript = sentenceCount
    ? statProfile.sentences
    : [{ id: "full", text: fullText, wordCount, cadenceDelta: 0, reasons: [] as string[] }];
  const flagged = statProfile.sentences.filter((s) => s.reasons.length > 0);
  const cadenceScore = statProfile.overallCadenceRisk;
  const reading = neuralScore !== null
    ? `Fusion of cadence ${cadenceScore}% and neural ${neuralScore}%`
    : "Cadence-weighted — neural model not run";

  return (
    <Document title={`ScholarShield Report — ${title}`} author="ScholarShield · ScholarBase" subject="ScholarShield AI writing risk report — powered by ScholarBase" creator="ScholarShield (computed locally by ScholarBase)" producer="@react-pdf/renderer — generated in-browser">
      {/* ------------------------------------------------------------ COVER */}
      <Page size="A4" style={styles.page}>
        <View style={styles.band} fixed>
          <Text style={styles.bandText}>SCHOLARSHIELD</Text>
          <Text style={styles.bandPowered}>powered by ScholarBase</Text>
          <Text style={styles.bandId}>{submissionId}</Text>
        </View>
        <View style={styles.brandLockup}>
          <View style={styles.brandIcon}>
            <Text style={styles.brandIconS}>S</Text>
            <Text style={styles.brandIconB}>B</Text>
          </View>
          <View style={styles.brandText}>
            <Text style={styles.brandName}>
              Scholar<Text style={styles.brandNameAccent}>Base</Text>
            </Text>
            <Text style={styles.brandByline}>Research Community Platform</Text>
          </View>
        </View>
        <Text style={styles.eyebrow}>ON-DEVICE AI WRITING RISK REPORT</Text>
        <Text style={styles.coverTitle}>{title}</Text>
        <View style={styles.rule} />
        <Text style={styles.coverSubtitle}>Sentence-cadence forensics and on-device neural analysis, compiled entirely inside this browser. Your document was never transmitted to any server.</Text>

        <View style={[styles.verdictCard, { borderColor: riskColor(overallScore), backgroundColor: riskSoft(overallScore) }]}>
          <Text style={[styles.verdictScore, { color: riskColor(overallScore) }]}>{overallScore}%</Text>
          <View style={styles.verdictDivider} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.verdictLabel, { color: riskColor(overallScore) }]}>{riskLabel(overallScore)}</Text>
            <Text style={styles.verdictHint}>Balanced result — cadence {cadenceScore}% · neural {neuralScore !== null ? `${neuralScore}%` : "not run"}</Text>
            <Text style={styles.verdictHint}>Burstiness sigma {statProfile.burstinessSigma} · vocabulary R {statProfile.guiraudIndex}</Text>
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          {[["Document", title], ["Submission ID", submissionId], ["Generated", timestamp], ["Words analysed", String(wordCount)], ["Sentences", String(sentenceCount || 1)], ["Flagged sentences", `${flagged.length}`], ["Detection mode", "100% on-device (browser WASM)"]].map(([label, value], i) => (
            <View key={label} style={[styles.metaRow, i % 2 === 1 ? styles.metaRowAlt : undefined]}>
              <Text style={styles.metaLabel}>{label}</Text>
              <Text style={styles.metaVal}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.noteBox}>
          <Text>HOW TO READ THIS REPORT — the balanced result on the cover is the headline verdict. Page 2 reports the cadence and neural signals separately before showing the balanced result, page 3 highlights flagged sentences in your own text, and page 4 lists each flag with its trigger.</Text>
        </View>
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>powered by ScholarBase · compiled locally, no data left this device</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* --------------------------------------------------------- OVERVIEW */}
      <Page size="A4" style={styles.page}>
        <View style={styles.band} fixed>
          <Text style={styles.bandText}>SCHOLARSHIELD · DIAGNOSTIC OVERVIEW</Text>
          <Text style={styles.bandPowered}>powered by ScholarBase</Text>
          <Text style={styles.bandId}>{submissionId}</Text>
        </View>
        <Text style={styles.sectionEyebrow}>SECTION 01</Text>
        <Text style={styles.sectionTitle}>Results at a glance</Text>

        <View style={[styles.banner, { borderColor: riskColor(overallScore), backgroundColor: riskSoft(overallScore) }]}>
          <Text style={[styles.bannerScore, { color: riskColor(overallScore) }]}>{overallScore}%</Text>
          <View style={[styles.bannerDivider, { backgroundColor: riskColor(overallScore) }]} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.bannerLabel, { color: riskColor(overallScore) }]}>{riskLabel(overallScore)}</Text>
            <Text style={[styles.bannerSub, { color: C.slate }]}>{reading}</Text>
            <Text style={[styles.bannerSub, { color: C.muted }]}>This balanced figure is the headline verdict — the two source signals are broken out below.</Text>
          </View>
        </View>

        {/* Cadence, neural, and balanced results reported separately below. */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Signal results — each signal and its value</Text>
          <View style={styles.cardRule} />
          <View style={styles.headRow}>
            <Text style={[styles.headCell, { width: "44%" }]}>Signal</Text>
            <Text style={[styles.headCell, { width: "18%" }]}>Value</Text>
            <Text style={[styles.headCell, { width: "38%" }]}>What it means</Text>
          </View>
          <View style={styles.bodyRow}>
            <Text style={[styles.cell, { width: "44%" }]}>Cadence result (rhythm only)</Text>
            <Text style={[styles.cellBold, { width: "18%", color: riskColor(cadenceScore) }]}>{cadenceScore}%</Text>
            <Text style={[styles.cell, { width: "38%" }]}>Sentence-length variation and uniformity — no vocabulary read.</Text>
          </View>
          <View style={[styles.bodyRow, styles.bodyRowAlt]}>
            <Text style={[styles.cell, { width: "44%" }]}>Neural result (RoBERTa)</Text>
            <Text style={[styles.cellBold, { width: "18%", color: neuralScore !== null ? riskColor(neuralScore) : C.muted }]}>{neuralScore !== null ? `${neuralScore}%` : "Not run"}</Text>
            <Text style={[styles.cell, { width: "38%" }]}>{neuralScore !== null ? "On-device language model probability that the text is machine-written." : "Run a Deep Neural Scan to add the on-device vocabulary signal."}</Text>
          </View>
          <View style={[styles.bodyRow, styles.bodyRowVerdict]}>
            <Text style={[styles.cellBold, { width: "44%" }]}>Balanced result (fusion)</Text>
            <Text style={[styles.cellBold, { width: "18%", color: riskColor(overallScore) }]}>{overallScore}%</Text>
            <Text style={[styles.cell, { width: "38%" }]}>{riskLabel(overallScore)} — trust this verdict over either single signal.</Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Supporting statistics</Text>
          <View style={styles.cardRule} />
          {[
            ["Burstiness sigma", `${statProfile.burstinessSigma} — human target > 7.0`],
            ["Shannon entropy (H)", `${statProfile.shannonEntropy} bits/token`],
            ["Guiraud richness (R)", `${statProfile.guiraudIndex}`],
            ["Mean sentence length", `${statProfile.meanSentenceLength} words`],
            ["Sentences / flagged", `${sentenceCount || 1} / ${flagged.length}`],
          ].map(([label, value], i) => (
            <View key={label} style={[styles.metaRow, i % 2 === 1 ? styles.metaRowAlt : undefined]}>
              <Text style={styles.metaLabel}>{label}</Text>
              <Text style={styles.metaVal}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Terms & Definitions</Text>
          <View style={styles.cardRule} />
          {[
            ["Cadence result", "How monotonous or varied sentence lengths are. Higher = more human-like rhythm. No vocabulary analysis."],
            ["Neural result", "On-device RoBERTa model probability that the text is machine-written. Only available in Deep Scan mode."],
            ["Balanced result", "Fusion of cadence and neural signals. This is the headline verdict — trust it over either single signal."],
            ["Burstiness sigma", "Statistical spread of sentence lengths. Human prose typically scores above 7.0."],
            ["Shannon entropy (H)", "Vocabulary unpredictability in bits per token. Higher = richer word choice."],
            ["Guiraud richness (R)", "Type-token ratio scaled by vocabulary size. Higher = more diverse vocabulary."],
            ["|Delta| (cadence delta)", "Word-count difference between neighbouring sentences. Small values mean monotonous rhythm."],
            ["Flagged sentence", "A sentence that tripped one or more structural patterns associated with machine writing."],
          ].map(([label, value], i) => (
            <View key={label} style={[styles.metaRow, i % 2 === 1 ? styles.metaRowAlt : undefined]}>
              <Text style={[styles.metaLabel, { width: "38%" }]}>{label}</Text>
              <Text style={[styles.cell, { width: "62%" }]}>{value}</Text>
            </View>
          ))}
        </View>

        <View style={styles.noteBox}>
          <Text>CAUTION — disciplined academic prose can present uniform rhythms, and rich jargon can mask machine writing from rhythm checks. Review these results alongside your own judgment; never decide authorship on this report alone.</Text>
        </View>
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>ScholarShield · powered by ScholarBase · Diagnostic overview</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* -------------------------------------------------------- TRANSCRIPT */}
      <Page size="A4" style={styles.page}>
        <View style={styles.band} fixed>
          <Text style={styles.bandText}>SCHOLARSHIELD · HIGHLIGHTED TRANSCRIPT</Text>
          <Text style={styles.bandPowered}>powered by ScholarBase</Text>
          <Text style={styles.bandId}>{submissionId}</Text>
        </View>
        <Text style={styles.sectionEyebrow}>SECTION 02</Text>
        <Text style={styles.sectionTitle}>Your text with flagged sentences shaded</Text>
        <View style={styles.legend}>
          <View style={styles.swatch} />
          <Text style={styles.legendText}>{flagged.length} of {sentenceCount || 1} sentences flagged · unshaded text passed every check</Text>
        </View>
        <Text style={styles.paragraph}>
          {transcript.map((sent, index) => (
            <Text key={sent.id ?? index} style={sent.reasons.length > 0 ? styles.flagged : styles.plain}>{sent.text}{" "}</Text>
          ))}
        </Text>
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>ScholarShield · powered by ScholarBase · Transcript</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ---------------------------------------------------------- APPENDIX */}
      <Page size="A4" style={styles.page}>
        <View style={styles.band} fixed>
          <Text style={styles.bandText}>SCHOLARSHIELD · AUDIT APPENDIX</Text>
          <Text style={styles.bandPowered}>powered by ScholarBase</Text>
          <Text style={styles.bandId}>{submissionId}</Text>
        </View>
        <Text style={styles.sectionEyebrow}>SECTION 03</Text>
        <Text style={styles.sectionTitle}>Flag audit table</Text>
        <View style={styles.appendixLegendContainer}>
          <View style={styles.appendixLegendItem}>
            <Text style={styles.appendixLegendLabel}>Words:</Text>
            <Text style={styles.appendixLegendValue}>Sentence length (word count)</Text>
          </View>
          <View style={{ width: 1, height: 10, backgroundColor: "#cbd5e1", alignSelf: "center", marginHorizontal: 6 }} />
          <View style={styles.appendixLegendItem}>
            <Text style={styles.appendixLegendLabel}>|Delta| (Delta):</Text>
            <Text style={styles.appendixLegendValue}>Word-count delta vs. adjacent sentences (low |Delta| = monotonous rhythm)</Text>
          </View>
          <View style={{ width: 1, height: 10, backgroundColor: "#cbd5e1", alignSelf: "center", marginHorizontal: 6 }} />
          <View style={styles.appendixLegendItem}>
            <Text style={styles.appendixLegendLabel}>Trigger:</Text>
            <Text style={styles.appendixLegendValue}>Structural pattern that raised the flag</Text>
          </View>
        </View>
        <View style={styles.headRow}>
          <Text style={[styles.headCell, { width: "8%" }]}>#</Text>
          <Text style={[styles.headCell, { width: "14%" }]}>WORDS</Text>
          <Text style={[styles.headCell, { width: "14%" }]}>|Delta|</Text>
          <Text style={[styles.headCell, { width: "64%" }]}>TRIGGER</Text>
        </View>
        {flagged.length === 0 && (
          <View style={styles.bodyRow}>
            <Text style={[styles.cell, { width: "100%" }]}>No sentences met the flag threshold. If this was a Quick Audit, run a Deep Neural Scan for the vocabulary signal.</Text>
          </View>
        )}
        {flagged.map((sent, i) => (
          <View key={sent.id} style={[styles.bodyRow, i % 2 === 1 ? styles.bodyRowAlt : undefined]}>
            <Text style={[styles.cell, { width: "8%" }]}>{i + 1}</Text>
            <Text style={[styles.cell, { width: "14%" }]}>{sent.wordCount}w</Text>
            <Text style={[styles.cell, { width: "14%" }]}>+/-{sent.cadenceDelta}</Text>
            <Text style={[styles.cell, { width: "64%" }]}>{sent.reasons.join("; ")}</Text>
          </View>
        ))}
        <View style={[styles.noteBox, { marginTop: 18 }]}>
          <Text>METHOD — ScholarShield runs entirely in this browser: cadence statistics are computed locally and, for a Deep Scan, the RoBERTa weights execute via WebAssembly. Neither your text nor this report was uploaded anywhere.</Text>
        </View>
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>ScholarShield · powered by ScholarBase · Audit appendix</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

