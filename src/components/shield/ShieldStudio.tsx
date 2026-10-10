"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, Check, Copy, Cpu, Download, FileText, HardDrive, Loader2, Lock, RotateCcw, ShieldAlert, Sparkles, UploadCloud } from "lucide-react";
import { analyzeCadenceAndEntropy, boostBurstiness, calculateBalancedEnsemble, forceBurstiness, type StatisticalProfile } from "@/lib/shield/statistical-analyzer";
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
import { getChromeRewriterAvailability, rewriteWithChrome } from "@/lib/shield/chrome-rewriter";
import { checkLocalModelCache, clearLocalModelCache, initializeLocalModel, isLocalGpuAvailable, rewriteWithLocalModel, type LocalDevice } from "@/lib/shield/local-rewriter";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { useToast } from "@/components/ui/Toast";
type ShieldTab = "detector" | "rewriter";
type DetectionMode = "quick" | "deep";
type RewriteProvider = "chrome" | "local-cpu" | "local-gpu" | "groq";
type ModelStatus = "idle" | "downloading" | "ready";
const clsx = (...i: Array<string | false | null | undefined>) => i.filter(Boolean).join(" ");
const countWords = (text: string) => text.trim() ? text.trim().split(/\s+/).length : 0;
// Rewriting varies sentence length to raise burstiness σ, which is a standard
// deviation — meaningless on a tiny fragment and impossible to push past the
// σ>7 floor with fewer than a few sentences. The detector uses a higher bar
// (50 words) because its entropy/cadence signals need more text to be
// statistically valid; rewriting only needs enough to rephrase, so the floors
// differ on purpose. Keep in sync with MIN_REWRITE_WORDS in the rewrite API.
const MIN_REWRITE_WORDS = 40;
const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(0, Math.round(bytes / 1024))} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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
  const activeTabRef = useRef(currentTab);
  useEffect(() => {
    activeTabRef.current = currentTab;
  }, [currentTab]);
  const startupToastKeys = useRef(new Set<string>());
  const toastForTab = useCallback((tab: ShieldTab, options: Parameters<typeof toast>[0]) => {
    if (activeTabRef.current !== tab) return;
    const key = `${tab}:${typeof options === "string" ? options : options.title ?? ""}`;
    if (startupToastKeys.current.has(key)) return;
    startupToastKeys.current.add(key);
    toast(typeof options === "string" ? options : { ...options, duration: options.duration ?? 6000 });
  }, [toast]);
  const setTab = useCallback((tab: ShieldTab) => {
    const p = new URLSearchParams(searchParams.toString());
    p.set("tab", tab);
    router.replace(`${pathname}?${p.toString()}`, { scroll: false });
  }, [searchParams, pathname, router]);
  const [inputText, setInputText] = useState("");
  const [statReport, setStatReport] = useState<StatisticalProfile | null>(null);
  const [neuralScore, setNeuralScore] = useState<number | null>(null);
  const [detectionMode, setDetectionMode] = useState<DetectionMode>("quick");
  const [isScanning, setIsScanning] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const workerRef = useRef<Worker | null>(null);
  const textRef = useRef("");
  useEffect(() => {
    textRef.current = inputText;
  }, [inputText]);
  const [modelStatus, setModelStatus] = useState<ModelStatus>("idle");
  const [modelCached, setModelCached] = useState(false);
  const [detectorCacheBytes, setDetectorCacheBytes] = useState(0);
  const [detectorCacheMeasured, setDetectorCacheMeasured] = useState(false);
  const [progress, setProgress] = useState(0);
  const [consent, setConsent] = useState(false);
  const [rewriteInput, setRewriteInput] = useState("");
  const [rewriteOutput, setRewriteOutput] = useState<string | null>(null);
  const [isRewriting, setIsRewriting] = useState(false);
  const [rewriteMeta, setRewriteMeta] = useState<{ originalScore: number | null; postRewriteCadence: number; originalSigma: number | null; postRewriteSigma: number; provider: string } | null>(null);
  const [rewriteProvider, setRewriteProvider] = useState<RewriteProvider>("local-cpu");
  const [chromeAvailability, setChromeAvailability] = useState<Awaited<ReturnType<typeof getChromeRewriterAvailability>>>("unavailable");
  const [chromeProgress, setChromeProgress] = useState(0);
  const [localProgress, setLocalProgress] = useState(0);
  const [localModelStatus, setLocalModelStatus] = useState<ModelStatus>("idle");
  const [localModelCached, setLocalModelCached] = useState(false);
  const [localCacheBytes, setLocalCacheBytes] = useState(0);
  const [localCacheMeasured, setLocalCacheMeasured] = useState(false);
  const [localConsent, setLocalConsent] = useState(false);
  const [localGpuAvailable, setLocalGpuAvailable] = useState(false);
  const [copied, setCopied] = useState(false);
  const [clearTarget, setClearTarget] = useState<"detector" | "rewriter" | null>(null);
  const [isClearing, setIsClearing] = useState(false);
  const [showDisclaimer, setShowDisclaimer] = useState(true);
  useEffect(() => {
    void getChromeRewriterAvailability().then((availability) => {
      setChromeAvailability(availability);
      if (availability === "available" || availability === "downloadable" || availability === "downloading") {
        setRewriteProvider((current) => current === "local-cpu" ? "chrome" : current);
        toastForTab("rewriter", { title: "Gemini Nano available", description: "Chrome can rewrite locally on-device. You can still choose Local CPU, Local GPU, or Groq.", duration: 6000 });
      } else {
        setRewriteProvider((current) => current === "chrome" ? "local-cpu" : current);
        toastForTab("rewriter", { title: "Gemini Nano unavailable", description: "Defaulting to the private Local CPU rewriter.", duration: 6000 });
      }
    });
    void isLocalGpuAvailable().then((gpuAvailable) => {
      setLocalGpuAvailable(gpuAvailable);
      toastForTab("rewriter", { title: gpuAvailable ? "Local GPU available" : "Local GPU unavailable", description: gpuAvailable ? "Transformers.js WebGPU rewriting is available on this device." : "The Local GPU option is disabled; Local CPU remains available.", duration: 6000 });
    });
    void checkLocalModelCache().then(({ cached, bytes }) => {
      setLocalCacheBytes(bytes);
      setLocalCacheMeasured(true);
      setLocalModelCached(cached);
      if (cached) {
        setLocalModelStatus("ready");
        toastForTab("rewriter", { title: "Local rewriter found in cache", description: "No download is needed. The cached FLAN-T5 model is ready when you rewrite.", duration: 6000 });
      }
    });
  }, [toast, toastForTab]);
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
    if (t.trim().split(/\s+/).length < 50) {
      toast({ title: "Short sample — inconclusive", description: "Quick Audit is more meaningful with at least 50 words. Add more text before interpreting the result." });
      return;
    }
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
    const wordCount = t.trim().split(/\s+/).length;
    if (wordCount < 50) {
      toast({ title: "Short sample — inconclusive", description: "The neural detector is intended for English samples of at least 50 words. Add more text before using Deep Scan." });
      return;
    }
    if (modelStatus !== "ready") {
      if (modelCached) {
        // The weights are cached, but the worker still needs to instantiate
        // the classifier after a page reload. This must not show consent or
        // trigger a network download.
        setModelStatus("downloading");
        setIsScanning(true);
        workerRef.current?.postMessage({ type: "INIT_MODEL" });
      } else {
        setConsent(true);
      }
      return;
    }
    doDeepScan(t);
  }, [isScanning, modelStatus, modelCached, doDeepScan, requireAuth, toast]);
  useEffect(() => {
    const w = new Worker(new URL("../../workers/detector.worker.ts", import.meta.url), { type: "module" });
    workerRef.current = w;
    w.onmessage = (e: MessageEvent) => {
      const { status, progress: pg, scores, totalWords, weightedSum, chunkCount, error, deleted, bytes, perWindow } = e.data ?? {};
      if (status === "downloading") { setModelStatus("downloading"); setProgress(pg ?? 0); }
      else if (status === "cache") {
        setDetectorCacheBytes(Number(bytes ?? 0));
        setDetectorCacheMeasured(true);
        if (e.data.cached) {
          setModelCached(true);
          setModelStatus("idle");
          setProgress(100);
          toastForTab("detector", { title: "Neural detector found in cache", description: "No download is needed. Deep Scan can use the cached model.", duration: 6000 });
        }
      }
      else if (status === "ready") {
        setModelStatus("ready"); setModelCached(true); setConsent(false); doDeepScan(textRef.current);
        toast({ title: "Neural engine ready", description: "Weights cached on-device. Running deep scan." });
      }
      else if (status === "cleared") {
        setIsClearing(false); setClearTarget(null);
        setModelStatus("idle"); setModelCached(false); setDetectorCacheBytes(0); setDetectorCacheMeasured(true); setProgress(0); setNeuralScore(null);
        toast({ title: "Detector cache cleared", description: bytes ? `Freed ${formatBytes(Number(bytes))} from ${deleted ?? 0} cached file(s).` : "Neural detector weights evicted." });
      }
      else if (status === "completed") {
        setIsScanning(false);
        const arr: number[] = scores ?? [];
        const avg = arr.length
          ? Math.round(((typeof weightedSum === "number" && totalWords ? weightedSum / totalWords : arr.reduce((a, b) => a + b, 0) / arr.length)) * 100)
          : 0;
        setNeuralScore(avg);
        // Diagnostic breadcrumb mirroring the worker: a flat neural score with a
        // high-confidence "human" argmax on academic prose is domain
        // miscalibration (H1), not proof the text is human. Logged once per scan.
        if (Array.isArray(perWindow) && perWindow.length && typeof console !== "undefined") {
          const rep = perWindow[0] as { argmaxLabel?: string; aiProb?: number; humanProb?: number | null };
          console.debug(
            `[Shield/UI] neural=${avg}% over ${chunkCount ?? arr.length} windows — sample argmax="${rep.argmaxLabel ?? "?"}" P(ai)=${(rep.aiProb ?? 0).toFixed(3)} P(human)=${rep.humanProb?.toFixed(3) ?? "n/a"}`,
          );
        }
        // Balanced fusion: lexical damping + divergence-aware blend.
        // Cadence NEVER overrides the neural score — disagreement lands amber.
        const report = analyzeCadenceAndEntropy(textRef.current);
        const fused = calculateBalancedEnsemble(avg, report.overallCadenceRisk, report.burstinessSigma, report.guiraudIndex, report.sentences.length);
        if (fused.classification === "amber" && (fused.signalDivergence ?? 0) > 40) {
          toast({ title: "Mixed signals — inconclusive, not AI-confirmed", description: `Neural ${avg}% vs damped cadence ${fused.dampedCadenceScore}% (σ=${report.burstinessSigma}, R=${report.guiraudIndex}). ${fused.explanation}` });
        } else {
          toast({ title: "Deep scan complete", description: `${chunkCount ?? arr.length} windows / ${totalWords ?? 0} words analyzed. Neural ${avg}% + cadence → balanced ${fused.finalScore}% (${fused.classification}). ${fused.explanation}` });
        }
      } else if (status === "error") {
        setIsScanning(false); setIsClearing(false); setClearTarget(null); setModelCached(false);
        const msg = String(error ?? "Worker error");
        setErr(msg);
        toast({ title: "Scholar Shield error", description: msg, variant: "destructive" });
      }
    };
    w.postMessage({ type: "CHECK_CACHE" });
    return () => { w.terminate(); workerRef.current = null; };
  }, [doDeepScan, toast, toastForTab]);
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
    if (!clearTarget) return;
    setIsClearing(true);
    if (clearTarget === "detector") {
      workerRef.current?.postMessage({ type: "CLEAR_CACHE" });
      setTimeout(() => {
        setIsClearing((clearing) => {
          if (clearing) {
            setModelStatus("idle"); setModelCached(false); setDetectorCacheBytes(0); setDetectorCacheMeasured(true); setProgress(0); setNeuralScore(null); setClearTarget(null);
            toast({ title: "Detector cache cleared", description: "Neural detector weights evicted from this browser." });
          }
          return false;
        });
      }, 3000);
      return;
    }
    void clearLocalModelCache().then(({ bytes, deleted }) => {
      setIsClearing(false); setClearTarget(null); setLocalModelStatus("idle"); setLocalModelCached(false); setLocalCacheBytes(0); setLocalCacheMeasured(true); setLocalProgress(0);
      toast({ title: "Rewriter cache cleared", description: bytes ? `Freed ${formatBytes(bytes)} from ${deleted} cached file(s).` : "FLAN-T5 rewriter weights evicted." });
    }).catch((error: unknown) => {
      setIsClearing(false); setClearTarget(null);
      const msg = error instanceof Error ? error.message : "Rewriter cache clear failed.";
      setErr(msg);
      toast({ title: "Rewriter cache clear failed", description: msg, variant: "destructive" });
    });
  }, [clearTarget, toast]);
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
    const rewriteWordCount = rewriteInput.trim().split(/\s+/).filter(Boolean).length;
    if (rewriteWordCount < MIN_REWRITE_WORDS) {
      toast({ title: "Add more text to humanize", description: `The rewriter needs at least ${MIN_REWRITE_WORDS} words (a few sentences) to vary sentence cadence meaningfully. Add more text and try again.` });
      return;
    }
    const requestedLocalDevice: LocalDevice | null = rewriteProvider === "local-gpu" ? "webgpu" : rewriteProvider === "local-cpu" ? "wasm" : null;
    if (requestedLocalDevice && !localModelCached) {
      setLocalConsent(true);
      return;
    }
    // Capture the cadence of the exact text being rewritten so we can show a
    // real sigma before→after delta (not a diagnostic-only post number).
    const originalSigma = analyzeCadenceAndEntropy(rewriteInput).burstinessSigma;
    setIsRewriting(true); setRewriteOutput(null); setRewriteMeta(null); setErr(null);
    setChromeProgress(0);
    try {
      let rewrittenText: string;
      let provider: string;
      if (rewriteProvider === "chrome") {
        rewrittenText = await rewriteWithChrome(rewriteInput, setChromeProgress);
        provider = "Gemini Nano (on-device)";
      } else if (rewriteProvider === "local-cpu" || rewriteProvider === "local-gpu") {
        const device: LocalDevice = rewriteProvider === "local-gpu" ? "webgpu" : "wasm";
        rewrittenText = await rewriteWithLocalModel(rewriteInput, device, setLocalProgress);
        provider = `FLAN-T5 Small (experimental on-device ${device === "webgpu" ? "GPU" : "CPU"})`;
      } else {
        const res = await fetch("/api/shield/rewrite", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ paragraph: rewriteInput }) });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Rewrite failed");
        rewrittenText = data.rewrittenText;
        provider = `${data.providerUsed} ${data.modelUsed}`;
      }
      // Deterministic burstiness pass for EVERY provider, applied per paragraph
      // so the `\n\n` structure survives (the passes re-punctuate sentences, and
      // flattening them would collapse paragraphs). Gemini Nano and Groq never
      // touched sentence-length variation; boostBurstiness nudges CV and
      // forceBurstiness pushes absolute σ above the >7 floor by building
      // long-vs-short sentence spread at clause boundaries. Protected tokens and
      // every word are preserved — only punctuation moves.
      rewrittenText = rewrittenText
        .split(/\n\s*\n/)
        .map((para) => {
          if (!para.trim()) return para;
          const boosted = boostBurstiness(para, 0.34, 2).text;
          return forceBurstiness(boosted, 7.5, 8).text;
        })
        .join("\n\n");
      const postRewriteReport = analyzeCadenceAndEntropy(rewrittenText);
      setRewriteOutput(rewrittenText);
      setRewriteMeta({ originalScore: statReport ? ensemble() : null, postRewriteCadence: postRewriteReport.overallCadenceRisk, originalSigma, postRewriteSigma: postRewriteReport.burstinessSigma, provider });
      const sigmaDelta = (postRewriteReport.burstinessSigma - originalSigma).toFixed(1);
      toast({ title: "Rewrite complete", description: `Cadence raised σ ${originalSigma} → ${postRewriteReport.burstinessSigma} (${sigmaDelta.startsWith("-") ? "" : "+"}${sigmaDelta}). Review every factual change; the cadence number is a diagnostic, not proof of authorship.`, duration: 6000 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Rewrite failed";
      setErr(msg);
      toast({ title: "Humanizer failed", description: msg, variant: "destructive" });
    } finally { setIsRewriting(false); }
  };
  const prepareLocalModel = useCallback(() => {
    const device: LocalDevice = rewriteProvider === "local-gpu" ? "webgpu" : "wasm";
    setLocalModelStatus("downloading");
    setLocalProgress(0);
    void initializeLocalModel(device, (value) => setLocalProgress(value)).then(() => {
      setLocalModelStatus("ready");
      setLocalModelCached(true);
      setLocalConsent(false);
      toast({ title: "Local CPU rewriter ready", description: "FLAN-T5 weights are cached in this browser. Your text will stay on-device." });
    }).catch((error: unknown) => {
      setLocalModelStatus("idle");
      setErr(error instanceof Error ? error.message : "Local rewriter model failed to load.");
      toast({ title: "Local rewriter download failed", description: "Try again on an unmetered connection or choose Gemini Nano/Groq.", variant: "destructive" });
    });
  }, [rewriteProvider, toast]);
  const words = inputText.trim() ? inputText.trim().split(/\s+/).length : 0;
  const rewriteWords = countWords(rewriteInput);
  const outputWords = countWords(rewriteOutput ?? "");
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
            <span className="flex items-center gap-1 rounded-full border border-blue-500/20 bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-600 dark:text-blue-400">AI Detection: Unlimited & Free</span>
          </div>
          <p className="mt-2 text-sm text-slate-600 sm:text-base dark:text-slate-400">Detection runs locally. Rewrite with Gemini Nano on-device, or Groq Cloud when you choose.</p>
          {err && <p className="mt-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs text-rose-600 dark:text-rose-300">{err}</p>}
        </div>
      </div>
      {showDisclaimer && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs text-amber-800 sm:text-sm dark:text-amber-200">
          <p>
            <strong>Diagnostic only:</strong> Shield scores are statistical
            estimates, not proof of AI authorship or plagiarism. Never use a
            score as the sole basis for an academic decision — always verify
            with human review. Detector scans, Gemini Nano rewrites, and Local
            CPU rewrites stay on your device; only Groq rewrites are sent to
            our AI sub-processor as described in our{" "}
            <a href="/privacy" className="underline">Privacy Policy</a>.
          </p>
          <button
            type="button"
            onClick={() => setShowDisclaimer(false)}
            aria-label="Dismiss disclaimer"
            className="shrink-0 rounded-lg px-2 py-1 font-semibold text-amber-700 hover:bg-amber-500/15 dark:text-amber-300"
          >
            Dismiss
          </button>
        </div>
      )}
      <div className="mb-8 flex w-full flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm sm:inline-flex sm:w-auto sm:gap-0 dark:border-slate-800 dark:bg-slate-950/80">
        <button type="button" onClick={() => setTab("detector")} className={clsx("rounded-xl px-6 py-2 font-semibold transition-all", currentTab === "detector" ? "bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100")}>AI Detector</button>
        <button type="button" onClick={() => setTab("rewriter")} className={clsx("flex items-center gap-2 rounded-xl px-6 py-2 font-semibold transition-all", currentTab === "rewriter" ? "bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950" : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100")}><Sparkles className="h-4 w-4" />AI Rewriter</button>
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
                <button type="button" onClick={() => setClearTarget("detector")} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-rose-500/40 dark:hover:text-rose-300"><HardDrive className="h-3.5 w-3.5" />Detector cache · {detectorCacheMeasured ? formatBytes(detectorCacheBytes) : "measuring…"}</button>
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
            <div className="mt-4 border-t border-slate-200/80 pt-3 dark:border-slate-800/80">
              <div className="mb-3 flex justify-end">
                <div className="flex rounded-lg border border-slate-300 p-0.5 text-[11px] dark:border-slate-700">
                  <button type="button" onClick={() => setDetectionMode("quick")} className={clsx("rounded-md px-2.5 py-1.5", detectionMode === "quick" && "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900")}>Quick Audit · 0 MB</button>
                  <button type="button" onClick={() => setDetectionMode("deep")} className={clsx("rounded-md px-2.5 py-1.5", detectionMode === "deep" && "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900")}>Deep Neural · local</button>
                </div>
                <InfoTooltip message={detectionMode === "quick" ? SHIELD_QUICK_AUDIT_TIP : SHIELD_DEEP_SCAN_TIP} />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => { setInputText(""); updateDraftField("detector", ""); setUploadedFilename(null); setDocumentTitle("Academic Manuscript"); setStatReport(null); setNeuralScore(null); setErr(null); }} disabled={!inputText} className="flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-medium text-slate-500 hover:bg-slate-100 disabled:opacity-40 dark:text-slate-400 dark:hover:bg-slate-800"><RotateCcw className="h-3.5 w-3.5" />Clear</button>
                <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isParsingDoc} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-slate-400 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
                  {isParsingDoc ? (<><Loader2 className="h-3.5 w-3.5 animate-spin" />Extracting locally...</>) : (<><UploadCloud className="h-3.5 w-3.5" />Upload PDF / DOCX</>)}
                </button>
                <InfoTooltip message={SHIELD_UPLOAD_TIP} />
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={detectionMode === "quick" ? quickAudit : deepScan} disabled={!inputText.trim() || isScanning} className="sb-button-accent flex items-center gap-2 disabled:opacity-50">{isScanning ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />Scanning on-device...</>) : detectionMode === "quick" ? (<><Cpu className="h-4 w-4" />Run Quick Audit</>) : (<><Cpu className="h-4 w-4" />Run Deep Scan</>)}</button>
              </div>
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
                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">{neuralScore !== null ? "TMR RAID detector · runs on-device" : "Not run yet — start Deep Scan"}</p>
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
              {statReport && (<button type="button" onClick={sendToRewriter} className="mt-3 flex items-center justify-center gap-1.5 rounded-xl bg-slate-800 py-2.5 text-xs font-semibold text-blue-300 hover:bg-slate-700">Send Flagged to Rewriter <ArrowRight className="h-3.5 w-3.5" /></button>)}
            </div>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm lg:col-span-6 dark:border-slate-800 dark:bg-slate-950/80">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2"><span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Text to rewrite<InfoTooltip message={SHIELD_REWRITE_INPUT_TIP} /></span><div className="flex items-center gap-2"><span className="text-xs text-slate-500 dark:text-slate-400">{rewriteWords} words | {rewriteInput.length} chars</span><button type="button" onClick={() => setClearTarget("rewriter")} className="inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm transition hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-rose-500/40 dark:hover:text-rose-300"><HardDrive className="h-3.5 w-3.5" />Rewriter cache · {localCacheMeasured ? formatBytes(localCacheBytes) : "measuring…"}</button></div></div>
            <textarea value={rewriteInput} onChange={(e) => { setRewriteInput(e.target.value); updateDraftField("rewriter", e.target.value); }} placeholder="Paste flagged paragraph..." rows={16} className="h-[430px] w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-4 font-mono text-sm leading-relaxed dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200" />
            <div className="mt-4 border-t border-slate-200/80 pt-3 dark:border-slate-800/80">
              <div className="mb-3 flex justify-end">
                <div className="flex flex-wrap rounded-lg border border-slate-300 p-0.5 text-[11px] dark:border-slate-700">
                  <button type="button" onClick={() => setRewriteProvider("chrome")} disabled={chromeAvailability === "unavailable"} className={clsx("rounded-md px-2 py-1.5", rewriteProvider === "chrome" && "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900", chromeAvailability === "unavailable" && "cursor-not-allowed opacity-40")}>Gemini Nano</button>
                  <button type="button" onClick={() => setRewriteProvider("local-cpu")} className={clsx("rounded-md px-2 py-1.5", rewriteProvider === "local-cpu" && "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900")}>Local CPU</button>
                  <button type="button" onClick={() => setRewriteProvider("local-gpu")} disabled={!localGpuAvailable} className={clsx("rounded-md px-2 py-1.5", rewriteProvider === "local-gpu" && "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900", !localGpuAvailable && "cursor-not-allowed opacity-40")}>Local GPU</button>
                  <button type="button" onClick={() => setRewriteProvider("groq")} className={clsx("rounded-md px-2 py-1.5", rewriteProvider === "groq" && "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900")}>Groq</button>
                </div>
              </div>
              <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setTab("detector")} className="text-xs font-medium text-slate-500 dark:text-slate-400">Back to Detector</button>
              </div>
              <div className="flex items-center gap-2">
                <InfoTooltip message={SHIELD_HUMANIZE_TIP} />
                <button type="button" onClick={humanize} disabled={!rewriteInput.trim() || isRewriting || (rewriteProvider === "chrome" && chromeAvailability === "unavailable") || (rewriteProvider === "local-gpu" && !localGpuAvailable)} className="sb-button-accent flex items-center gap-2 disabled:opacity-50">{isRewriting ? (<><span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />{rewriteProvider === "chrome" && chromeAvailability === "downloading" && chromeProgress ? `Downloading ${chromeProgress}%` : (rewriteProvider === "local-cpu" || rewriteProvider === "local-gpu") && localModelStatus === "downloading" && localProgress ? `Downloading ${localProgress}%` : "Rewriting..."}</>) : (<><Sparkles className="h-4 w-4" />Rewrite with {rewriteProvider === "chrome" ? "Gemini Nano" : rewriteProvider === "local-cpu" ? "Local CPU" : rewriteProvider === "local-gpu" ? "Local GPU" : "Groq"}</>)}</button>
              </div>
            </div>
          </div>
          </div>
          <div className="flex flex-col rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm lg:col-span-6 dark:border-slate-800 dark:bg-slate-950/80">
            <div className="mb-2 flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Restructured output<InfoTooltip message={SHIELD_REWRITE_OUTPUT_TIP} /></span>
              <div className="flex flex-wrap items-center justify-end gap-2 text-[11px] font-medium text-slate-500 dark:text-slate-400"><span>{outputWords} words | {rewriteOutput?.length ?? 0} chars</span>{rewriteMeta && <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300" title="Burstiness sigma (sentence-length variation) before → after humanization">σ {rewriteMeta.originalSigma === null ? "--" : rewriteMeta.originalSigma} → {rewriteMeta.postRewriteSigma}</span>}{rewriteMeta && <span>Before {rewriteMeta.originalScore === null ? "—" : `${rewriteMeta.originalScore}%`} · cadence after {rewriteMeta.postRewriteCadence}% · {rewriteMeta.provider}</span>}</div>
            </div>
            <div className="h-[430px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-4 font-serif text-sm leading-relaxed dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">{rewriteOutput ? <p className="whitespace-pre-wrap">{rewriteOutput}</p> : <p className="flex h-full items-center justify-center text-xs text-slate-500">No output yet.</p>}</div>
            <div className="mt-4 flex items-center justify-end border-t border-slate-200/80 pt-3 dark:border-slate-800/80">
              {rewriteOutput && <button type="button" onClick={async () => { await navigator.clipboard.writeText(rewriteOutput); setCopied(true); setTimeout(() => setCopied(false), 2000); }} className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-100">{copied ? (<><Check className="h-3.5 w-3.5 text-emerald-400" />Copied</>) : (<><Copy className="h-3.5 w-3.5" />Copy</>)}</button>}
            </div>
          </div>
        </div>
      )}
        <ConfirmationModal
        isOpen={clearTarget !== null}
        onClose={() => !isClearing && setClearTarget(null)}
        onConfirm={clearModelCache}
        title={`Free ${clearTarget === "detector" ? "detector" : "rewriter"} cache?`}
        message={`This deletes only the cached ${clearTarget === "detector" ? "TMR detector" : "FLAN-T5 rewriter"} model (${formatBytes(clearTarget === "detector" ? detectorCacheBytes : localCacheBytes)}). ${clearTarget === "detector" ? "Quick Audit keeps working instantly." : "The rewriter will download the model again when you choose it."}`}
        isConfirming={isClearing}
        confirmLabel={`Delete ${clearTarget === "detector" ? "Detector" : "Rewriter"} Cache`}
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
        modelSize="~125 MB quantized ONNX"
      />
      <ModelDownloadModal
        isOpen={localConsent}
        progress={localProgress}
        isDownloading={localModelStatus === "downloading"}
        title={`Load Local ${rewriteProvider === "local-gpu" ? "GPU" : "CPU"} Rewriter`}
        description={`The local FLAN-T5 rewriter runs through Transformers.js on your ${rewriteProvider === "local-gpu" ? "GPU with WebGPU" : "CPU with WebAssembly"}. It is slower than Gemini Nano or Groq, but your text never leaves this browser.`}
        modelSize="~110 MB quantized ONNX"
        confirmLabel="Download Local Rewriter"
        onClose={() => {
          if (localModelStatus !== "downloading") setLocalConsent(false);
        }}
        onConfirm={prepareLocalModel}
      />
    </div>
  );
}
export const ShieldStudio = ShieldStudioInner;
export default ShieldStudioInner;
