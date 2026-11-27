"use client";

import { useState } from "react";
import { clsx } from "clsx";
import {
  Download,
  Loader2,
  Search,
  Sparkles,
  Play,
  Camera,
  KeyRound,
  Settings2,
} from "lucide-react";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import type { NetnoKitComment, NetnoKitMetadata } from "@/lib/netnokit/types";

type Platform = "youtube" | "instagram";
type Tab = Platform;

export default function NetnoKitStudio() {
  const [tab, setTab] = useState<Tab>("youtube");
  const [url, setUrl] = useState("");
  const [provider, setProvider] = useState<"youtube-shared" | "youtube-byok" | "scrapecreators">("youtube-shared");
  const [apiKey, setApiKey] = useState("");
  const [maxComments, setMaxComments] = useState(1000);
  const [includeReplies, setIncludeReplies] = useState(false);
  const [anonymize, setAnonymize] = useState(true);
  const [studySalt] = useState(() => crypto.randomUUID());
  const [collecting, setCollecting] = useState(false);
  const [exporting, setExporting] = useState<"csv" | "xlsx" | null>(null);
  const [comments, setComments] = useState<NetnoKitComment[]>([]);
  const [metadata, setMetadata] = useState<NetnoKitMetadata | null>(null);
  const [error, setError] = useState<string | null>(null);

  const platform: Platform = tab;

  const handleCollect = async () => {
    if (!url.trim() || collecting) return;
    setCollecting(true);
    setError(null);
    setComments([]);
    setMetadata(null);
    try {
      const res = await fetch("/api/netnokit/collect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: url.trim(),
          provider,
          apiKey: apiKey.trim() || undefined,
          maxComments,
          includeReplies,
          anonymize,
          studySalt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Collection failed");
      setComments(data.comments as NetnoKitComment[]);
      setMetadata(data.metadata as NetnoKitMetadata);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Collection failed");
    } finally {
      setCollecting(false);
    }
  };

  const handleExport = async (format: "csv" | "xlsx") => {
    if (comments.length === 0 || exporting) return;
    setExporting(format);
    try {
      const res = await fetch("/api/netnokit/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, comments, metadata, anonymize }),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `netnokit_export.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Export failed");
    } finally {
      setExporting(null);
    }
  };

  const showByKey = platform === "youtube" && provider === "youtube-byok";
  const showScrapeKey = platform === "instagram";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">NetnoKit</h1>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Export YouTube and Instagram comments as CSV or Excel for netnographic research.
        </p>
      </div>

      <div className="mb-8 flex w-full flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white/80 p-1.5 shadow-sm sm:inline-flex sm:w-auto sm:gap-0 dark:border-slate-800 dark:bg-slate-950/80">
        <button
          type="button"
          onClick={() => { setTab("youtube"); setProvider("youtube-shared"); setUrl(""); setError(null); }}
          className={clsx(
            "flex items-center gap-2 rounded-xl px-6 py-2 font-semibold transition-all",
            tab === "youtube"
              ? "bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
          )}
        >
          <Play className="h-4 w-4" /> YouTube
        </button>
        <button
          type="button"
          onClick={() => { setTab("instagram"); setProvider("scrapecreators"); setUrl(""); setError(null); }}
          className={clsx(
            "flex items-center gap-2 rounded-xl px-6 py-2 font-semibold transition-all",
            tab === "instagram"
              ? "bg-slate-950 text-white shadow-sm dark:bg-slate-100 dark:text-slate-950"
              : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100",
          )}
        >
          <Camera className="h-4 w-4" /> Instagram
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm lg:col-span-7 dark:border-slate-800 dark:bg-slate-950/80">
          <div className="mb-3 flex items-center gap-2">
            <Settings2 className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Source</h2>
          </div>

          <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
            Video / post URL
            <InfoTooltip message="Paste a public YouTube or Instagram URL. Private or deleted content cannot be collected." />
          </label>
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder={platform === "youtube" ? "https://www.youtube.com/watch?v=..." : "https://www.instagram.com/p/..."}
            className="mb-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
            maxLength={2048}
          />
          <p className="mb-3 text-right text-xs text-slate-400">{url.length}/2048</p>

          {platform === "youtube" && (
            <div className="mb-3 flex gap-2">
              <button
                type="button"
                onClick={() => setProvider("youtube-shared")}
                className={clsx(
                  "rounded-xl px-3 py-1.5 text-sm font-semibold transition-all",
                  provider === "youtube-shared"
                    ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                )}
              >
                ScholarBase key
              </button>
              <button
                type="button"
                onClick={() => setProvider("youtube-byok")}
                className={clsx(
                  "rounded-xl px-3 py-1.5 text-sm font-semibold transition-all",
                  provider === "youtube-byok"
                    ? "bg-slate-950 text-white dark:bg-slate-100 dark:text-slate-950"
                    : "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
                )}
              >
                My own key
              </button>
            </div>
          )}

          {(showByKey || showScrapeKey) && (
            <div className="mb-3">
              <label className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-600 dark:text-slate-300">
                <KeyRound className="h-3.5 w-3.5" /> API key
                <InfoTooltip message="Your key is used for this request only and is never stored. YouTube keys come from Google Cloud; Instagram keys from ScrapeCreators." />
              </label>
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={showByKey ? "YouTube Data API v3 key" : "ScrapeCreators API key"}
                className="mb-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-800"
                maxLength={256}
              />
              <p className="text-right text-xs text-slate-400">{apiKey.length}/256</p>
            </div>
          )}

          {(showByKey || showScrapeKey) && (
            <details className="mb-3 text-xs text-slate-600 dark:text-slate-300">
              <summary className="cursor-pointer font-medium">How to get a free key</summary>
              <p className="mt-1">
                {showByKey ? (
                  <>
                    Google Cloud Console → create a project → enable{" "}
                    <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener noreferrer" className="underline">
                      YouTube Data API v3
                    </a>{" "}
                    → create an API key → restrict it to that API.{" "}
                    <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline">
                      Open console
                    </a>
                  </>
                ) : (
                  <>
                    Sign up at{" "}
                    <a href="https://scrapecreators.com/" target="_blank" rel="noopener noreferrer" className="underline">
                      scrapecreators.com
                    </a>{" "}
                    → dashboard → API Keys (100 free credits, no card).
                  </>
                )}
              </p>
            </details>
          )}

          <div className="mb-3 flex flex-wrap items-center gap-4">
            <label className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Max comments
              <InfoTooltip message="Collection stops at this many comments. Set a sampling boundary for reproducibility." />
              <input
                type="number"
                min={1}
                max={10000}
                value={maxComments}
                onChange={(e) => setMaxComments(Math.max(1, Math.min(10000, Number(e.target.value) || 1000)))}
                className="ml-2 w-20 rounded-xl border border-slate-300 bg-white px-2 py-1 text-sm dark:border-slate-600 dark:bg-slate-800"
              />
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={includeReplies} onChange={(e) => setIncludeReplies(e.target.checked)} />
              Include replies
            </label>
            <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-300">
              <input type="checkbox" checked={anonymize} onChange={(e) => setAnonymize(e.target.checked)} />
              Anonymize authors
            </label>
          </div>

          <button
            type="button"
            onClick={handleCollect}
            disabled={collecting || !url.trim()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-all hover:bg-slate-800 disabled:opacity-50 dark:bg-slate-100 dark:text-slate-950 dark:hover:bg-slate-200"
          >
            {collecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
            Collect
          </button>

          {error && <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
        </div>

        <div className="flex flex-col rounded-2xl border border-slate-200 bg-white/80 p-4 shadow-sm lg:col-span-5 dark:border-slate-800 dark:bg-slate-950/80">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Results</h2>
          </div>
          {metadata ? (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                Collected {metadata.totalComments} comments
                {metadata.truncated ? " (limit reached)" : ""}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Provider: {metadata.provider} · {metadata.collectedAt}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleExport("csv")}
                  disabled={!!exporting}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {exporting === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => handleExport("xlsx")}
                  disabled={!!exporting}
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-1.5 text-sm font-semibold text-slate-700 transition-all hover:bg-slate-200 disabled:opacity-50 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
                >
                  {exporting === "xlsx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                  Excel
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No collection yet. Paste a URL and click Collect.
            </p>
          )}
        </div>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Use only for research consistent with platform terms of service and your ethics board. Anonymization is assistive, not IRB compliance. Data is never stored on ScholarBase servers.
      </p>
    </div>
  );
}
