// Bisect harness for the "Download AI Report PDF hangs the page" bug.
// PDF_VARIANT selects what runs:
//   minimal   - bare @react-pdf/renderer doc (toolchain sanity)
//   analyzer  - statistical analyzer only, 320-sentence manuscript
//   short     - full AuditReportDocument with a tiny manuscript
//   full      - full AuditReportDocument with ~33k-char manuscript (hang repro)
import { describe, expect, it } from "vitest";
import React from "react";
import { pdf, Document, Page, Text, View } from "@react-pdf/renderer";
import { AuditReportDocument } from "@/components/shield/pdf/AuditReportDocument";
import { analyzeCadenceAndEntropy } from "@/lib/shield/statistical-analyzer";

const variant = process.env.PDF_VARIANT ?? "full";

function buildSampleText(sentenceCount = 320): string {
  const parts: string[] = [];
  for (let i = 0; i < sentenceCount; i++) {
    const len = 8 + (i % 17);
    const words = Array.from({ length: len }, (_, w) => `term${(i * 7 + w) % 250}`);
    parts.push(words.join(" ") + ".");
  }
  return parts.join(" ");
}

describe(`AuditReportDocument (${variant})`, () => {
  it(
    variant,
    async () => {
      if (variant === "minimal") {
        const blob = await pdf(
          React.createElement(Document, null,
            React.createElement(Page, null, React.createElement(Text, null, "hello"))),
        ).toBlob();
        console.log(`[bisect] minimal OK: ${blob.size} bytes`);
        expect(blob.size).toBeGreaterThan(100);
        return;
      }

      const sentenceCount = variant === "short" ? 3 : 320;
      const fullText = buildSampleText(sentenceCount);

      if (variant === "analyzer") {
        const t0 = Date.now();
        const profile = analyzeCadenceAndEntropy(fullText);
        console.log(`[bisect] analyzer OK: ${Date.now() - t0}ms, ${profile.sentences.length} sentences`);
        expect(profile.sentences.length).toBeGreaterThan(100);
        return;
      }

      // Mini-doc battery: isolate which react-pdf pattern loops.
      const mini: Record<string, React.ReactElement> = {
        // Exact diegomura/react-pdf#3245 repro: lineHeight Text in flex row.
        "m-lh-row": React.createElement(Page, { size: "A4", style: { fontSize: 9.5 } },
          React.createElement(View, { style: { flexDirection: "row", alignItems: "center" } },
            React.createElement(Text, { style: { fontSize: 19.2, lineHeight: 25.6, color: "#333333" } }, "42.0"))),
        // LineHeight Texts in column flow (coverTitle + noteBox patterns).
        "m-lh-col": React.createElement(Page, { size: "A4", style: { paddingHorizontal: 48, paddingTop: 56 } },
          React.createElement(Text, { style: { fontSize: 27, fontWeight: "bold", marginTop: 10, lineHeight: 32 } }, "A Title"),
          React.createElement(View, { style: { backgroundColor: "#eff6ff", borderLeftWidth: 3, padding: 10, marginBottom: 14, fontSize: 8, color: "#475569", lineHeight: 1.45 } },
            React.createElement(Text, null, "Note box body"))),
        // Justified outer Text with nested inline Text children (transcript).
        "m-justify": React.createElement(Page, { size: "A4", style: { paddingHorizontal: 48, paddingTop: 56 } },
          React.createElement(Text, { style: { marginBottom: 10, textAlign: "justify" } },
            React.createElement(Text, null, "First flagged sentence here. "),
            React.createElement(Text, null, "Second sentence follows it. "),
            React.createElement(Text, null, "Third sentence ends the page. "))),
        // Fixed absolute band + footer with render prop.
        "m-fixed": React.createElement(Page, { size: "A4", style: { paddingHorizontal: 48, paddingTop: 56 } },
          React.createElement(View, { fixed: true, style: { position: "absolute", top: 0, left: 0, right: 0, height: 34, paddingHorizontal: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: "#0f172a" } },
            React.createElement(Text, { style: { color: "#e2e8f0", fontSize: 7.5, letterSpacing: 1.4 } }, "SCHOLARSHIELD"),
            React.createElement(Text, { style: { fontSize: 7.5, letterSpacing: 0.6 } }, "ssh:oid:::1234:1712345678")),
          React.createElement(Text, null, "Body content on the page."),
          React.createElement(View, { fixed: true, style: { position: "absolute", bottom: 0, left: 0, right: 0, height: 30, paddingHorizontal: 48, flexDirection: "row", justifyContent: "space-between", alignItems: "center", borderTopWidth: 1, backgroundColor: "#ffffff" } },
            React.createElement(Text, { style: { fontSize: 7.5 } }, "Compiled locally"),
            React.createElement(Text, { style: { fontSize: 7.5 }, render: ({ pageNumber, totalPages }: { pageNumber: number; totalPages: number }) => `Page ${pageNumber} of ${totalPages}` }))),
        // Verdict card: fixed-width score + divider + flex:1 column in a row.
        "m-verdict": React.createElement(Page, { size: "A4", style: { paddingHorizontal: 48, paddingTop: 56 } },
          React.createElement(View, { style: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 6, padding: 16, marginBottom: 24, borderColor: "#d97706", backgroundColor: "#fffbeb" } },
            React.createElement(Text, { style: { fontSize: 40, fontWeight: "bold", width: 110, textAlign: "center", color: "#d97706" } }, "64%"),
            React.createElement(View, { style: { width: 1, height: 46, marginHorizontal: 14 } }),
            React.createElement(View, { style: { flex: 1 } },
              React.createElement(Text, { style: { fontSize: 10, fontWeight: "bold", letterSpacing: 1.2 } }, "MIXED SIGNALS"),
              React.createElement(Text, { style: { fontSize: 8.5, color: "#64748b", marginTop: 4 } }, "Balanced result hint")))),
        // Percent-width table row.
        "m-table": React.createElement(Page, { size: "A4", style: { paddingHorizontal: 48, paddingTop: 56 } },
          React.createElement(View, { style: { flexDirection: "row", padding: 7, borderBottomWidth: 0.5 } },
            React.createElement(Text, { style: { fontSize: 8, width: "44%" } }, "Cadence result (rhythm only)"),
            React.createElement(Text, { style: { fontSize: 8, width: "18%", fontWeight: "bold" } }, "64%"),
            React.createElement(Text, { style: { fontSize: 8, width: "38%" } }, "Sentence-length variation and uniformity — no vocabulary read."))),
        // Split of m-lh-col: which of the two hangs?
        "m-lh-title": React.createElement(Page, { size: "A4", style: { paddingHorizontal: 48, paddingTop: 56 } },
          React.createElement(Text, { style: { fontSize: 27, fontWeight: "bold", marginTop: 10, lineHeight: 32 } }, "A Title")),
        // The fix: unitless lineHeight is a multiplier (CSS semantics), so
        // 1.2 x 27pt ~= 32pt line box — visually identical, cannot exceed the page.
        "m-lh-title-fix": React.createElement(Page, { size: "A4", style: { paddingHorizontal: 48, paddingTop: 56 } },
          React.createElement(Text, { style: { fontSize: 27, fontWeight: "bold", marginTop: 10, lineHeight: 1.2 } }, "A Title")),
        "m-lh-title-no": React.createElement(Page, { size: "A4", style: { paddingHorizontal: 48, paddingTop: 56 } },
          React.createElement(Text, { style: { fontSize: 27, fontWeight: "bold", marginTop: 10 } }, "A Title")),
        "m-lh-note": React.createElement(Page, { size: "A4", style: { paddingHorizontal: 48, paddingTop: 56 } },
          React.createElement(View, { style: { backgroundColor: "#eff6ff", borderLeftWidth: 3, padding: 10, marginBottom: 14, fontSize: 8, color: "#475569", lineHeight: 1.45 } },
            React.createElement(Text, null, "Note box body"))),
        // Fix candidates: lineHeight safely above fontSize.
        "m-lh-note-fix": React.createElement(Page, { size: "A4", style: { paddingHorizontal: 48, paddingTop: 56 } },
          React.createElement(View, { style: { backgroundColor: "#eff6ff", borderLeftWidth: 3, padding: 10, marginBottom: 14, fontSize: 8, color: "#475569", lineHeight: 12 } },
            React.createElement(Text, null, "Note box body"))),
        // Degenerate lineHeight set DIRECTLY on Text (no View inheritance).
        "m-lh-small": React.createElement(Page, { size: "A4", style: { paddingHorizontal: 48, paddingTop: 56 } },
          React.createElement(Text, { style: { fontSize: 8, lineHeight: 1.45 } }, "Tiny line height text")),
      };
      if (mini[variant]) {
        const t0 = Date.now();
        const blob = await pdf(React.createElement(Document, null, mini[variant])).toBlob();
        console.log(`[bisect] ${variant} OK: ${Date.now() - t0}ms, ${blob.size} bytes`);
        expect(Date.now() - t0).toBeLessThan(8000);
        expect(blob.size).toBeGreaterThan(50);
        return;
      }

      const statProfile = analyzeCadenceAndEntropy(fullText);
      const started = Date.now();
      const blob = await pdf(
        React.createElement(AuditReportDocument, {
          title: "The Intraday Bleed: Retail Noise and the Night-and-Day Anomaly",
          submissionId: "ssh:oid:::1234:1712345678",
          timestamp: "Oct 5, 2026, 8:47 PM",
          overallScore: 64,
          statProfile,
          neuralScore: 33,
          fullText,
        }),
      ).toBlob();
      const elapsed = Date.now() - started;
      console.log(`[bisect] ${variant} OK: compiled in ${elapsed}ms, ${blob.size} bytes`);
      expect(blob.size).toBeGreaterThan(1000);
      expect(elapsed).toBeLessThan(8000);
    },
    120_000,
  );
});
