// ScholarShield PDF generation runs away from the UI thread. Mobile browsers
// have much less CPU headroom, so react-pdf layout must not run in a click
// handler on the main thread.
import React from "react";
import { pdf } from "@react-pdf/renderer";
import {
  AuditReportDocument,
  type ReportProps,
} from "@/components/shield/pdf/AuditReportDocument";

type PdfRequest = {
  requestId: string;
  props: ReportProps;
};

self.addEventListener("message", async (event: MessageEvent<PdfRequest>) => {
  const { requestId, props } = event.data ?? {};
  if (!requestId || !props) return;

  try {
    const blob = await pdf(
      React.createElement(AuditReportDocument, props),
    ).toBlob();
    const buffer = await blob.arrayBuffer();

    // Transfer ownership instead of copying the potentially large PDF.
    self.postMessage(
      { status: "ready", requestId, buffer },
      { transfer: [buffer] },
    );
  } catch (error) {
    self.postMessage({
      status: "error",
      requestId,
      error: error instanceof Error ? error.message : "PDF compilation failed.",
    });
  }
});
