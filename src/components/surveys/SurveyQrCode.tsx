"use client";

import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, QrCode, Share2, X } from "lucide-react";
import { ShareButton } from "@/components/interactions/ShareButton";
import { getSurveyShareUrl, SURVEY_SHARE_ORIGIN } from "@/lib/surveys/share";

export function SurveyQrCode({ surveyId, surveyTitle }: { surveyId: string; surveyTitle: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shareOrigin, setShareOrigin] = useState(SURVEY_SHARE_ORIGIN);
  const shareUrl = getSurveyShareUrl(surveyId, shareOrigin);

  useEffect(() => {
    // The browser origin automatically selects localhost, staging, or
    // production without baking one deployment's host into the client bundle.
    setShareOrigin(window.location.origin);
  }, []);

  useEffect(() => {
    if (!open || !canvasRef.current) return;
    setError(null);
    void QRCode.toCanvas(canvasRef.current, shareUrl, {
      width: 280,
      margin: 2,
      errorCorrectionLevel: "H",
      color: { dark: "#0f172a", light: "#ffffff" },
    }).catch(() => setError("We could not generate the QR code. Please try again."));
  }, [open, shareUrl]);

  const downloadQrCode = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${surveyTitle.trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "survey"}-qr-code.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-blue-500 dark:hover:text-blue-300"
      >
        <QrCode className="h-4 w-4" />
        QR code
      </button>

      {open && (
        <div
          className="fixed inset-0 z-modal flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="survey-qr-title"
          onClick={(event) => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <section className="w-full max-w-sm rounded-2xl border border-slate-200 bg-white p-5 text-center shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between text-left">
              <div>
                <h2 id="survey-qr-title" className="text-lg font-bold text-slate-950 dark:text-white">
                  Scan to respond
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">Share this survey with respondents.</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Close QR code"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mx-auto mb-3 flex min-h-[280px] items-center justify-center rounded-xl bg-white p-3">
              {error ? (
                <p className="text-sm text-red-600">{error}</p>
              ) : (
                <canvas ref={canvasRef} aria-label={`QR code for ${surveyTitle}`} />
              )}
            </div>
            <p className="break-all text-xs font-semibold text-blue-700 dark:text-blue-300">{shareUrl}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Powered by ScholarBase</p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:justify-center">
              <button
                type="button"
                onClick={downloadQrCode}
                disabled={!!error}
                className="sb-button-primary gap-2"
              >
                <Download className="h-4 w-4" />
                Download QR
              </button>
              <ShareButton
                href={shareUrl}
                title={surveyTitle}
                text="Respond to this ScholarBase survey"
                label="Share link"
                variant="primary"
                icon={Share2}
              />
            </div>
          </section>
        </div>
      )}
    </>
  );
}
