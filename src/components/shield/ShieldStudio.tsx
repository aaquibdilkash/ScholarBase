"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Copy, Cpu, Download, FileText, HardDrive, Loader2, Lock, RotateCcw, ShieldAlert, Sparkles, UploadCloud } from "lucide-react";
import { analyzeCadenceAndEntropy, calculateBalancedEnsemble, type StatisticalProfile } from "@/lib/shield/statistical-analyzer";
import { parseDocumentClientSide } from "@/lib/shield/document-parser";
import { useFormDraft } from "@/hooks/useFormDraft";
import { useUser } from "@/hooks/useUser";
import { useAuthModal } from "@/components/interactions/AuthModal";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  SHIELD_BALANCED_TIP,
  SHIELD_BURSTINESS_TIP,
  SHIELD_CADENCE_TIP,
  SHIELD_DEEP_SCAN_TIP,
  SHIELD_FREE_CACHE_TIP,
  SHIELD_GUIRAUD_TIP,
  SHIELD_HEATMAP_TIP,
  SHIELD_HUMANIZE_TIP,
  SHIELD_LOCAL_INPUT_TIP,
  SHIELD_NEURAL_TIP,
  SHIELD_PDF_TIP,
  SHIELD_QUICK_AUDIT_TIP,
  SHIELD_REWRITE_INPUT_TIP,
  SHIELD_REWRITE_OUTPUT_TIP,
  SHIELD_UPLOAD_TIP,
} from "@/constants/tooltips";
import { ModelDownloadModal } from "@/components/shield/ModelDownloadModal";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { useToast } from "@/components/ui/Toast";
type ShieldTab = "detector" | "rewriter";
type ModelStatus = "idle" | "downloading" | "ready";
const clsx = (...i: Array<string | false | null | undefined>) => i.filter(Boolean).join(" ");
export function ShieldStudioInner({ initialTab = "detector" }: { initialTab?: ShieldTab }) {
  const { toast } = useToast();
  const { user } = useUser();
  const { openAuthModal } = useAuthModal();
  // Auth guard: scans and humanizing require a signed-in scholar.
  const requireAuth = useCallback((): boolean => {
    if (!user) {
      openAuthModal();
      return false;
    }
    return true;
  }, [user, openAuthModal]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlTab = searchParams.get("tab");
  const currentTab: ShieldTab = urlTab === "rewriter" ? "rewriter" : urlTab === "detector" ? "detector" : initialTab;
  const setTab = useCallback((tab: ShieldTab) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", tab);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }, [searchParams, pathname, router]);
  const [inputText, setInputText] = useState("");
  const [statReport, setStatReport] = useState<StatisticalProfile | null>(null);
  const [neuralScore, setNeuralScore] = useState<number | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const textRef = useRef("");
  useEffect(() => {
    textRef.current = inputText;
  }, [inputText]);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [progress, setProgress] = useState(0);
  const [consent, setConsent] = useState(false);
  const [rewriteInput, setRewriteInput] = useState("");
  const [rewriteOutput, setRewriteOutput] = useState<string | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteMeta, setRewriteMeta] = useState<{ originalScore: number; verifiedScore: number; provider: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [clearConfirm, setClearConfirm] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const ensemble = useCallback((): number => {
    if (!statReport) return 0;
    return calculateBalancedEnsemble(
      neuralScore,
      statReport.overallCadenceRisk,
      statReport.burstinessSigma,
      statReport.guiraudIndex,
      statReport.sentences.length,
    ).finalScore;
  }, [statReport, neuralScore]);
  // Form-draft persistence: detector + rewriter inputs survive refresh (localStorage only).
  const [draftFields, updateDraftField, _resetDraft, isDraftRestored] = useFormDraft(
    "shield-studio-draft-v1",
    { detector: "", rewriter: "" },
  );
  const [documentTitle, setDocumentTitle] = useState("Academic Manuscript");
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [isParsingDoc, setIsParsingDoc] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  // Hydrate inputs from restored draft once (upload/paste afterwards wins).
  const draftHydratedRef = useRef(false);
  useEffect(() => {
    if (!isDraftRestored || draftHydratedRef.current) return;
    draftHydratedRef.current = true;
    if (draftFields.detector && !textRef.current) setInputText(draftFields.detector);
    if (draftFields.rewriter) setRewriteInput(draftFields.rewriter);
  }, [isDraftRestored, draftFields.detector, draftFields.rewriter]);
  const handleFile = useCallback(async (file: File) => {
    setIsParsingDoc(true);
    try {
      const parsed = await parseDocumentClientSide(file);
      const capped = parsed.text.length > 200000 ? parsed.text.slice(0, 200000) : parsed.text;
      setInputText(capped);
      updateDraftField("detector", capped);
      setDocumentTitle(parsed.title);
      setUploadedFilename(parsed.filename);
      setStatReport(null);
      setNeuralScore(null);
      toast({ title: "Document loaded locally", description: `${parsed.filename} — ${parsed.wordCount} words${parsed.pageCount ? `, ${parsed.pageCount} pages` : ""}. Never left this browser.` });
    } catch (err) {
      toast({ title: "Could not parse document", description: err instanceof Error ? err.message : "Upload failed.", variant: "destructive" });
    } finally {
      setIsParsingDoc(false);
    }
  }, [toast, updateDraftField]);
  const downloadPdfReport = useCallback(async () => {
    if (!statReport || !inputText.trim() || isGeneratingPdf) return;
    setIsGeneratingPdf(true);
    try {
      const { pdf } = await import("@react-pdf/renderer");
      const { AuditReportDocument } = await import("@/components/shield/pdf/AuditReportDocument");
      const submissionId = `ssh:oid:::${Math.floor(1000 + Math.random() * 9000)}:${Date.now().toString().slice(-8)}`;
      const timestamp = new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
      const blob = await pdf(
        <AuditReportDocument
          title={documentTitle}
          submissionId={submissionId}
          timestamp={timestamp}
          overallScore={ensemble()}
          statProfile={statReport}
          neuralScore={neuralScore}
          fullText={inputText}
        />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ScholarShield_by_ScholarBase_Report_${submissionId.replace(/[:]/g, "_")}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast({ title: "ScholarShield report downloaded", description: "Powered by ScholarBase — vector PDF compiled in this browser, paper never left the device." });
    } catch {
      toast({ title: "PDF generation failed", description: "Could not compile the audit report on this device.", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  }, [statReport, inputText, isGeneratingPdf, documentTitle, neuralScore, toast, ensemble]);
  const doDeepScan = useCallback((text: string) => {
    if (!text.trim()) return;
    setIsScanning(true); setErr(null);
    setStatReport(analyzeCadenceAndEntropy(text));
    const paras = text.split(/\n\s*\n/).filter((p) => p.trim());
    workerRef.current?.postMessage({ type: "SCAN_PARAGRAPHS", data: { paragraphs: paras.length ? paras : [text] } });
  }, []);
  const quickAudit = useCallback(() => {
    const t = textRef.current;
    if (!t.trim()) return;
    if (!requireAuth()) return;
    setErr(null);
    const report = analyzeCadenceAndEntropy(t);
    setStatReport(report);
    setNeuralScore(null);
    // No hard flag: Quick Audit is cadence-only and misses vocabulary depth.
    // Rich scholarly prose (Guiraud R≥6.5) damps the structural score.
    const preview = calculateBalancedEnsemble(null, report.overallCadenceRisk, report.burstinessSigma, report.guiraudIndex, report.sentences.length);
    if (preview.classification === "high") {
      toast({ title: "Uniform cadence noted", description: `σ=${report.burstinessSigma}, R=${report.guiraudIndex}. Cadence-only signal — run Deep Scan to check vocabulary before judging.` });
    } else if (preview.classification === "amber") {
      toast({ title: "Cadence-only estimate is inconclusive", description: `Rich vocabulary (R=${report.guiraudIndex}) tempers structural uniformity. Deep Scan recommended.` });
    }
  }, [toast, requireAuth]);
  const deepScan = useCallback(() => {
    const t = textRef.current;
    if (!t.trim() || isScanning) return;
    if (!requireAuth()) return;
    if (modelStatus !== "ready") { setConsent(true); return; }
    doDeepScan(t);
  }, [isScanning, modelStatus, doDeepScan, requireAuth]);
  useEffect(() => {
    const w = new Worker(new URL("../../workers/detector.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;
    w.onmessage = (e: MessageEvent) => {
      const { status, progress: pg, scores, error, deleted } = e.data ?? {};
      if (status === "downloading") { setModelStatus("downloading"); setProgress(pg ?? 0); }
      else if (status === "ready") {
        setModelStatus("ready"); setConsent(false); doDeepScan(textRef.current);
        toast({ title: "Neural engine ready", description: "Weights cached on-device. Running deep scan." });
      }
      else if (status === "cleared") {
        setIsClearing(false); setClearConfirm(false);
        setModelStatus("idle"); setProgress(0); setNeuralScore(null);
        toast({ title: "Model cache cleared", description: deleted ? `Freed ${deleted} cached weight bundle(s) from this device.` : "Neural weights evicted. Storage freed on this device." });
      }
      else if (status === "completed") {
        setIsScanning(false);
        const arr: number[] = scores ?? [];
        const avg = arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 100) : 0;
        setNeuralScore(avg);
        // Balanced fusion: lexical damping + divergence-aware blend.
        // Cadence NEVER overrides the neural score — disagreement lands amber.
        const report = analyzeCadenceAndEntropy(textRef.current);
        const fused = calculateBalancedEnsemble(avg, report.overallCadenceRisk, report.burstinessSigma, report.guiraudIndex, report.sentences.length);
        if (fused.classification === "amber" && (fused.signalDivergence ?? 0) > 40) {
          toast({ title: "Mixed signals — inconclusive, not AI-confirmed", description: `Neural ${avg}% vs damped cadence ${fused.dampedCadenceScore}% (σ=${report.burstinessSigma}, R=${report.guiraudIndex}). ${fused.explanation}` });
        } else {
          toast({ title: "Deep scan complete", description: `Neural ${avg}% + cadence → balanced ${fused.finalScore}% (${fused.classification}). ${fused.explanation}` });
        }
      } else if (status === "error") {
        setIsScanning(false); setIsClearing(false);
        const msg = String(error ?? "Worker error");
        setErr(msg);
        toast({ title: "Scholar Shield error", description: msg, variant: "destructive" });
      }
    };
    return () => { w.terminate(); workerRef.current = null; };
  }, [doDeepScan, toast]);
  // Amber "mixed signals" band: strong neural↔cadence disagreement stays
  // inconclusive — it must NEVER be forced red by cadence alone.
  const ensembleDetail = statReport
    ? calculateBalancedEnsemble(
        neuralScore,
        statReport.overallCadenceRisk,
        statReport.burstinessSigma,
        statReport.guiraudIndex,
        statReport.sentences.length,
      )
    : null;
  const clearModelCache = useCallback(() => {
    setIsClearing(true);
    try {
      workerRef.current?.postMessage({ type: "CLEAR_CACHE" });
      // Fallback: if worker never responds (e.g. terminated), reset locally after 3s.
      setTimeout(() => {
        setIsClearing((clearing) => {
          if (clearing) {
            setModelStatus("idle"); setProgress(0); setNeuralScore(null); setClearConfirm(false);
            toast({ title: "Model cache cleared", description: "Neural weights evicted. Storage freed on this device." });
          }
          return false;
        });
      }, 3000);
    } catch (err: unknown) {
      setIsClearing(false);
      const msg = err instanceof Error ? err.message : "Cache clear failed.";
      setErr(msg);
      toast({ title: "Cache clear failed", description: msg, variant: "destructive" });
    }
  }, [toast]);
  const sendToRewriter = () => {
    const paras = inputText.split(/\n\s*\n/).filter((p) => p.trim());
    const flagged = (statReport?.sentences ?? []).filter((s) => s.reasons.length).map((s) => s.text);
    const hit = paras.filter((p) => flagged.some((f) => p.includes(f)));
    setRewriteInput(hit.length ? hit.join("\n\n") : inputText);
    setRewriteOutput(null); setRewriteMeta(null);
    setTab("rewriter");
  };
  const humanize = async () => {
    if (!requireAuth()) return;
    if (!rewriteInput.trim() || isRewriting) return;
    setIsRewriting(true); setRewriteOutput(null); setRewriteMeta(null); setErr(null);
    try {
      const res = await fetch("/api/shield/rewrite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paragraph: rewriteInput, initialRiskScore: ensemble() || 85 }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Rewrite failed");
      setRewriteOutput(data.rewrittenText);
      setRewriteMeta({ originalScore: data.originalRiskScore, verifiedScore: data.verifiedRiskScore, provider: `${data.providerUsed} ${data.modelUsed}` });
      toast(
      { title: "Humanized successfully", description: `Risk ${data.originalRiskScore}% → ${data.verifiedRiskScore}%. Academic entities preserved.` });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Rewrite failed";
      setErr(msg);
      toast({ title: "Humanizer failed", description: msg, variant: "destructive" });
    } finally { setIsRewriting(false); }
  };
  const words = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const score = ensemble();
  return (
    <div>
      <input
        type="file"
        ref={fileInputRef}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
          e.target.value = "";
        }}
        accept=".pdf,.docx,.txt,.md"
        className="hidden"
        aria-hidden
        tabIndex={-1}
      />
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10 text-blue-500 dark:text-blue-400"><ShieldAlert className="h-5 w-5" /></span>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-950 sm:text-4xl dark:text-slate-50">Scholar Shield</h1>
            <span className="flex items-center gap-1 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2.5 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400"><Lock className="h-3 w-3" />100% On-Device Detection</span>
          </div>
          <p className="mt-2 text-sm text-slate-600 sm:text-base dark:text-slate-400">Papers never leave your browser. Local DeBERTa/RoBERTa + Groq 120B humanizer.</p>
          {err && <p className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">{err}</p>}
        </div>
      </div>
      <div className="mb-8 flex w-full flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm sm:inline-flex sm:w-auto sm:gap-0 dark:border-slate-800 dark:bg-slate-950/80">
        <button type="button" onClick={() => setTab("detector")} className={clsx("rounded-xl px-6 py-2 font-semibold transition-all", currentTab === "detector" ? "bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100")}>AI Detector</button>
        <button type="button" onClick={() => setTab("rewriter")} className={clsx("flex items-center gap-2 rounded-xl px-6 py-2 font-semibold transition-all", currentTab === "rewriter" ? "bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100")}><Sparkles className="h-4 w-4" />120B Humanizer</button>
      </div>
      {currentTab === "detector" ? (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div
            className="flex flex-col rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm lg:col-span-7 dark:border-slate-800 dark:bg-slate-950/80"
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => { e.preventDefault(); setIsDragging(false); const f = e.dataTransfer.files?.[0]; if (f) void handleFile(f); }}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                Input (local memory only)
                <InfoTooltip message={SHIELD_LOCAL_INPUT_TIP} />
                {uploadedFilename && (
                  <span className="inline-flex max-w-55 items-center gap-1 truncate rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-medium normal-case tracking-normal text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    <FileText className="h-3 w-3 shrink-0" />{uploadedFilename}
                  </span>
                )}
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">{words} words | {inputText.length} chars</span>
                <button type="button" onClick={() => setClearConfirm(true)} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-rose-500/40 dark:hover:text-rose-300"><HardDrive className="h-3.5 w-3.5" />Free ~130 MB</button>
                <InfoTooltip message={SHIELD_FREE_CACHE_TIP} />
              </div>
            </div>
            <div className="relative min-h-[460px] flex-1">
            <textarea value={inputText} onChange={(e) => { setInputText(e.target.value); updateDraftField("detector", e.target.value); setStatReport(null); setNeuralScore(null); }} placeholder="Paste confidential draft, thesis chapter... or drag & drop a PDF / DOCX here" rows={18} className="h-full min-h-[460px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-relaxed text-slate-900 placeholder-slate-400 focus:border-slate-950 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:placeholder-slate-600 dark:focus:border-slate-100" />
            {isDragging && (
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-500 bg-white/85 backdrop-blur-sm dark:bg-slate-950/85">
                <UploadCloud className="h-10 w-10 animate-bounce text-slate-500" />
                <p className="mt-2 text-sm font-semibold">Drop PDF or DOCX to parse in local memory</p>
                <p className="text-xs text-slate-500">Never transmitted to any server</p>
              </div>
            )}
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3 dark:border-slate-800/80">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setInputText(""); updateDraftField("detector", ""); setUploadedFilename(null); setDocumentTitle("Academic Manuscript"); setStatReport(null); setNeuralScore(null); setErr(null); }} disabled={!inputText} className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"><RotateCcw className="h-3.5 w-3.5" />Clear</button>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isParsingDoc} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {isParsingDoc ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Extracting locally...</>) : (<><UploadCloud className="h-3.5 w-3.5" />Upload PDF / DOCX</>)}
                </button>
                <InfoTooltip message={SHIELD_UPLOAD_TIP} />
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={quickAudit} disabled={!inputText.trim()} className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 disabled:opacity-40 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">Quick Audit (0 MB)</button>
                <InfoTooltip message={SHIELD_QUICK_AUDIT_TIP} />
                <button type="button" onClick={deepScan} disabled={!inputText.trim() || isScanning} className="sb-button-accent flex items-center gap-2 disabled:opacity-50">{isScanning ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Scanning on-device...</>) : (<><Cpu className="h-4 w-4" />Deep Neural Scan</>)}</button>
                <InfoTooltip message={SHIELD_DEEP_SCAN_TIP} />
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-4 lg:col-span-5">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Audit summary<InfoTooltip message={SHIELD_PDF_TIP} /></span>
              <button type="button" onClick={() => void downloadPdfReport()} disabled={!statReport || isGeneratingPdf} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                {isGeneratingPdf ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Generating PDF...</>) : (<><Download className="h-3.5 w-3.5" />Download AI Report PDF</>)}
              </button>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">Cadence result<InfoTooltip message={SHIELD_CADENCE_TIP} /></span>
                <div className="mt-3 text-3xl font-extrabold"><span className={clsx(!statReport ? "text-slate-300 dark:text-slate-600" : statReport.overallCadenceRisk >= 70 ? "text-rose-500" : statReport.overallCadenceRisk >= 40 ? "text-amber-500" : "text-emerald-500")}>{statReport ? `${statReport.overallCadenceRisk}%` : "--"}</span></div>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400">σ={statReport ? statReport.burstinessSigma : "—"} · vocab R={statReport ? statReport.guiraudIndex : "—"}<InfoTooltip message={SHIELD_GUIRAUD_TIP} /></p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">Neural result<InfoTooltip message={SHIELD_NEURAL_TIP} /></span>
                <div className="mt-3 text-3xl font-extrabold"><span className={clsx(neuralScore === null ? "text-slate-300 dark:text-slate-600" : neuralScore >= 70 ? "text-rose-500" : neuralScore >= 40 ? "text-amber-500" : "text-emerald-500")}>{neuralScore !== null ? `${neuralScore}%` : "--"}</span></div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{neuralScore !== null ? "RoBERTa · runs fully on-device" : "Not run yet — start Deep Scan"}</p>
              </div>
              <div className="rounded-2xl border border-slate-300 bg-slate-100/80 p-4 shadow-sm dark:border-slate-700 dark:bg-slate-900/80">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-300">Balanced AI risk<InfoTooltip message={SHIELD_BALANCED_TIP} /></span>
                <div className="mt-3 text-3xl font-extrabold"><span className={clsx(!statReport || !ensembleDetail ? "text-slate-300 dark:text-slate-600" : ensembleDetail.classification === "high" ? "text-rose-500" : ensembleDetail.classification === "amber" ? "text-amber-500" : "text-emerald-500")}>{statReport ? `${score}%` : "--"}</span></div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{statReport ? (neuralScore !== null ? (ensembleDetail ? ensembleDetail.explanation : `Fusion of neural ${neuralScore}%`) : `Cadence-weighted (neural not run) — run Deep Scan`) : "Awaiting scan"}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
                <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">Burstiness sigma<InfoTooltip message={SHIELD_BURSTINESS_TIP} /></span>
                <div className="mt-3 text-3xl font-extrabold"><span className={clsx(!statReport ? "text-slate-300 dark:text-slate-600" : statReport.burstinessSigma < 4.2 ? "text-rose-500" : "text-emerald-500")}>{statReport ? statReport.burstinessSigma : "--"}</span></div>
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">target &gt; 7.0 {statReport ? `| H=${statReport.shannonEntropy}` : ""}</p>
              </div>
            </div>
            <div className="flex flex-1 flex-col rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-950/80">
              <div className="mb-3 flex items-center justify-between border-b border-slate-200 pb-2 dark:border-slate-800">
                <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Sentence heatmap<InfoTooltip message={SHIELD_HEATMAP_TIP} /></span>
                <span className="text-[11px] text-slate-500">hover for reason</span>
              </div>
              <div className="h-[310px] overflow-y-auto rounded-xl border border-slate-200/80 bg-slate-50 p-3 text-sm leading-relaxed dark:border-slate-800/80 dark:bg-slate-900">
                {statReport ? (<div>{statReport.sentences.map((s) => (<span key={s.id} title={s.reasons.join(" | ") || "Normal cadence"} className={clsx("mr-1.5 inline cursor-help rounded px-1 py-0.5", s.reasons.length ? "bg-rose-500/20 text-rose-700 dark:text-rose-200" : "text-slate-700 dark:text-slate-300")}>{s.text} </span>))}</div>) : (<p className="flex h-full items-center justify-center text-center text-xs text-slate-500">No scan yet. Quick Audit is instant; Deep Scan downloads the model once.</p>)}
              </div>
              {statReport && (<button type="button" onClick={sendToRewriter} className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-blue-300 hover:bg-slate-700">Send Flagged to 120B Humanizer <ArrowRight className="h-3.5 w-3.5" /></button>)}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm lg:col-span-6 dark:border-slate-800 dark:bg-slate-950/80">
            <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Flagged text (only this leaves device)<InfoTooltip message={SHIELD_REWRITE_INPUT_TIP} /></span>
            <textarea value={rewriteInput} onChange={(e) => { setRewriteInput(e.target.value); updateDraftField("rewriter", e.target.value); }} placeholder="Paste flagged paragraph..." rows={16} className="h-[430px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-relaxed dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200" />
            <div className="mt-4 flex items-center justify-between border-t border-slate-200/80 pt-3 dark:border-slate-800/80">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setTab("detector")} className="text-xs font-medium text-slate-500 dark:text-slate-400">Back to Detector</button>
              </div>
              <div className="flex items-center gap-2">
                <InfoTooltip message={SHIELD_HUMANIZE_TIP} />
                <button type="button" onClick={humanize} disabled={!rewriteInput.trim() || isRewriting} className="sb-button-accent flex items-center gap-2 disabled:opacity-50">{isRewriting ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Restructuring...</>) : (<><Sparkles className="h-4 w-4" />Humanize Prose</>)}</button>
              </div>
            </div>
          </div>
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm lg:col-span-6 dark:border-slate-800 dark:bg-slate-950/80">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Restructured output<InfoTooltip message={SHIELD_REWRITE_OUTPUT_TIP} /></span>
              {rewriteMeta && <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400">{rewriteMeta.originalScore}% to {rewriteMeta.verifiedScore}% | {rewriteMeta.provider}</span>}
            </div>
            <div className="h-[430px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-serif text-sm leading-relaxed dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">{rewriteOutput ? <p className="whitespace-pre-wrap">{rewriteOutput}</p> : <p className="flex h-full items-center justify-center text-xs text-slate-500">No output yet.</p>}</div>
            <div className="mt-4 flex items-center justify-end border-t border-slate-200/80 pt-3 dark:border-slate-800/80">
              {rewriteOutput && <button type="button" onClick={async () => { await navigator.clipboard.writeText(rewriteOutput); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-100">{copied ? (<><Check className="h-3.5 w-3.5 text-emerald-400" />Copied</>) : (<><Copy className="h-3.5 w-3.5" />Copy</>)}</button>}
            </div>
          </div>
        </div>
      )}
      <ConfirmationModal
        isOpen={clearConfirm}
        onClose={() => !isClearing && setClearConfirm(false)}
        onConfirm={clearModelCache}
        title="Free device storage?"
        message="This deletes the downloaded neural weights (~130 MB) from this browser. Quick Audit keeps working instantly; Deep Scan will re-download once on Wi-Fi."
        isConfirming={isClearing}
        confirmLabel="Delete Model Cache"
        confirmingLabel="Clearing..."
        confirmVariant="destructive"
        confirmClassName="sb-button-primary min-w-44"
      />
      <ModelDownloadModal
        isOpen={consent}
        progress={progress}
        isDownloading={modelStatus === "downloading"}
        onClose={() => {
          if (modelStatus !== "downloading") setConsent(false);
        }}
        onConfirm={() => workerRef.current?.postMessage({ type: "INIT_MODEL" })}
      />
    </div>
  );
}
export const ShieldStudio = ShieldStudioInner;
export default ShieldStudioInner;
