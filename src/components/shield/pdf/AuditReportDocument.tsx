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
  coverTitle: { fontSize: 27, fontWeight: "bold", color: C.ink, marginTop: 10, lineHeight: 32 },
  rule: { width: 56, height: 4, backgroundColor: C.blue, marginVertical: 14 },
  coverSubtitle: { fontSize: 11, color: C.slate, marginBottom: 26, maxWidth: "80%" },
  verdictCard: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: C.line,
    borderRadius: 6,
    padding: 16,
    marginBottom: 24,
  },
  verdictScore: { fontSize: 40, fontWeight: "bold", width: 110, textAlign: "center" },
  verdictDivider: { width: 1, height: 46, backgroundColor: C.line, marginHorizontal: 14 },
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
    borderWidth: 1,
    borderRadius: 6,
    padding: 16,
    marginBottom: 18,
  },
  bannerScore: { fontSize: 34, fontWeight: "bold", width: 96, textAlign: "center" },
  bannerDivider: { width: 1, height: 40, marginHorizontal: 14, opacity: 0.3 },
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
  sectionTitle: { fontSize: 15, fontWeight: "bold", color: C.ink, marginBottom: 12 },
  legend: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  swatch: { width: 14, height: 9, backgroundColor: "#fee2e2", marginRight: 6 },
  legendText: { fontSize: 8, color: C.muted },
  paragraph: { marginBottom: 10, textAlign: "justify" },
  flagged: { backgroundColor: "#fee2e2", color: "#991b1b" },
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
    <Document title={`ScholarShield Report — ${title}`} author="ScholarShield" subject="On-device AI writing risk report" creator="ScholarShield (computed locally)" producer="@react-pdf/renderer — generated in-browser">
      {/* ------------------------------------------------------------ COVER */}
      <Page size="A4" style={styles.page}>
        <View style={styles.band} fixed>
          <Text style={styles.bandText}>SCHOLARSHIELD</Text>
          <Text style={styles.bandId}>{submissionId}</Text>
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
            <Text style={styles.verdictHint}>Burstiness σ {statProfile.burstinessSigma} · vocabulary R {statProfile.guiraudIndex}</Text>
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
          <Text style={styles.footerText}>Compiled locally · no data left this device</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* --------------------------------------------------------- OVERVIEW */}
      <Page size="A4" style={styles.page}>
        <View style={styles.band} fixed>
          <Text style={styles.bandText}>SCHOLARSHIELD · DIAGNOSTIC OVERVIEW</Text>
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
            ["Burstiness sigma (σ)", `${statProfile.burstinessSigma} — human target > 7.0`],
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

        <View style={styles.noteBox}>
          <Text>CAUTION — disciplined academic prose can present uniform rhythms, and rich jargon can mask machine writing from rhythm checks. Review these results alongside your own judgment; never decide authorship on this report alone.</Text>
        </View>
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>ScholarShield · Diagnostic overview</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* -------------------------------------------------------- TRANSCRIPT */}
      <Page size="A4" style={styles.page}>
        <View style={styles.band} fixed>
          <Text style={styles.bandText}>SCHOLARSHIELD · HIGHLIGHTED TRANSCRIPT</Text>
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
          <Text style={styles.footerText}>ScholarShield · Transcript</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>

      {/* ---------------------------------------------------------- APPENDIX */}
      <Page size="A4" style={styles.page}>
        <View style={styles.band} fixed>
          <Text style={styles.bandText}>SCHOLARSHIELD · AUDIT APPENDIX</Text>
          <Text style={styles.bandId}>{submissionId}</Text>
        </View>
        <Text style={styles.sectionEyebrow}>SECTION 03</Text>
        <Text style={styles.sectionTitle}>Flag audit table</Text>
        <Text style={[styles.legendText, { marginBottom: 12 }]}>Words = sentence length · Δ = word-count difference versus neighbouring sentences (small Δ = monotonous rhythm) · Trigger = structural pattern that raised the flag.</Text>
        <View style={styles.headRow}>
          <Text style={[styles.headCell, { width: "8%" }]}>#</Text>
          <Text style={[styles.headCell, { width: "14%" }]}>WORDS</Text>
          <Text style={[styles.headCell, { width: "14%" }]}>Δ</Text>
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
            <Text style={[styles.cell, { width: "14%" }]}>±{sent.cadenceDelta}</Text>
            <Text style={[styles.cell, { width: "64%" }]}>{sent.reasons.join("; ")}</Text>
          </View>
        ))}
        <View style={[styles.noteBox, { marginTop: 18 }]}>
          <Text>METHOD — detection runs entirely in this browser: cadence statistics are computed locally and, for a Deep Scan, the RoBERTa weights execute via WebAssembly. Neither your text nor this report was uploaded anywhere.</Text>
        </View>
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>ScholarShield · Audit appendix</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}

