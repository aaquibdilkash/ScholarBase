"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Eye,
  Info,
  Loader2,
  Mail,
  Monitor,
  PenLine,
  RotateCcw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmationModal } from "@/components/ui/ConfirmationModal";
import { useToast } from "@/components/ui/Toast";
import { useFormDraft } from "@/hooks/useFormDraft";
import { sendAdminScholarInviteAction } from "@/app/actions/adminInvite";
import {
  buildScholarOutreachBody,
  generateScholarInviteHtml,
  getScholarInvitationContextLine,
} from "@/lib/emails/scholarInvite";

interface InviteDraft {
  [key: string]: string;
  scholarName: string;
  scholarEmail: string;
  university: string;
  department: string;
  subject: string;
  greeting: string;
  headline: string;
  body: string;
  ctaLabel: string;
  senderName: string;
  senderRole: string;
  footerText: string;
}

const INITIAL_DRAFT: InviteDraft = {
  scholarName: "",
  scholarEmail: "",
  university: "",
  department: "",
  subject: "Only For Scholars: A Transparent Introduction to ScholarBase",
  greeting: "Greetings",
  headline: "A Quiet Workspace for the Noisy Academic Life",
  body: "We're writing to introduce ScholarBase, an academic community we’re building for doctoral researchers and faculty.\n\nIt includes research surveys designed specifically for scholars, spaces to discuss research and supervisor experiences, and a growing collection of research tools and academic resources. If that sounds relevant to your work, you’re welcome to take a look.",
  ctaLabel: "Visit ScholarBase",
  senderName: "ScholarBase",
  senderRole: "ScholarBase Team",
  footerText: "If you would prefer not to receive further notes, simply reply and let us know.",
};

const previewUrl = (
  process.env.NEXT_PUBLIC_SITE_URL || "https://scholarbase.app"
).replace(/\/+$/, "");

const inputClassName =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";

function FieldLabel({
  children,
  optional = false,
}: {
  children: ReactNode;
  optional?: boolean;
}) {
  return (
    <span className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
      {children}
      {optional && <span className="font-normal text-slate-400">Optional</span>}
    </span>
  );
}

function FieldHeader({
  label,
  optional = false,
  showDefault = false,
  onUseDefault,
}: {
  label: string;
  optional?: boolean;
  showDefault?: boolean;
  onUseDefault?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <FieldLabel optional={optional}>{label}</FieldLabel>
      {showDefault && onUseDefault && (
        <button
          type="button"
          onClick={onUseDefault}
          className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold text-blue-700 transition hover:border-blue-300 hover:bg-blue-100 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-300 dark:hover:bg-blue-500/20"
        >
          Use default
        </button>
      )}
    </div>
  );
}

export function AdminInviteScholarForm() {
  const [draft, updateDraftField, resetDraft, isRestored] = useFormDraft(
    "admin-scholar-outreach-draft-v2",
    INITIAL_DRAFT,
  );
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<"compose" | "preview">("compose");
  const [isSending, setIsSending] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const updateField = <K extends Extract<keyof InviteDraft, string>>(
    field: K,
    value: string,
  ) => {
    updateDraftField(field, value);
  };

  const applyDefault = (
    field: Exclude<Extract<keyof InviteDraft, string>, "scholarName" | "scholarEmail" | "university" | "department">,
  ) => {
    updateField(field, INITIAL_DRAFT[field]);
  };

  const previewHtml = useMemo(
    () =>
      generateScholarInviteHtml({
        scholarName: draft.scholarName.trim() || "Scholar",
        subject: draft.subject.trim() || INITIAL_DRAFT.subject,
        greeting: draft.greeting.trim() || INITIAL_DRAFT.greeting,
        headline: draft.headline.trim() || INITIAL_DRAFT.headline,
        body: buildScholarOutreachBody({
          body: draft.body.trim() || INITIAL_DRAFT.body,
          university: draft.university,
          department: draft.department,
        }),
        ctaLabel: draft.ctaLabel.trim() || INITIAL_DRAFT.ctaLabel,
        inviteUrl: previewUrl,
        senderName: draft.senderName.trim() || INITIAL_DRAFT.senderName,
        senderRole: draft.senderRole.trim() || INITIAL_DRAFT.senderRole,
        footerText: draft.footerText.trim() || INITIAL_DRAFT.footerText,
      }),
    [draft],
  );

  const canSend =
    isRestored &&
    draft.scholarEmail.trim().length > 0 &&
    draft.subject.trim().length > 0 &&
    draft.body.trim().length > 0;

  const contextLine = getScholarInvitationContextLine({
    university: draft.university,
    department: draft.department,
  });

  const executeSend = async (isTestSend: boolean) => {
    setIsConfirmOpen(false);
    if (isTestSend) setIsSendingTest(true);
    else setIsSending(true);

    try {
      const result = await sendAdminScholarInviteAction({
        ...draft,
        isTestSend,
      });

      if (result.success) {
        toast(result.message, "success");
      } else {
        toast(result.error, "error");
      }
    } catch (error) {
      console.error("Admin scholar outreach failed:", error);
      toast("The email could not be sent. Please try again.", "error");
    } finally {
      setIsSending(false);
      setIsSendingTest(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-blue-50 p-3 text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
              <Mail className="h-5 w-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100">Scholar outreach</h2>
                <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">Admin only</span>
              </div>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">Write a transparent introduction, edit every visible line, and review the Gmail-style message before sending.</p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start rounded-lg border border-slate-200 bg-slate-50 p-1 dark:border-slate-700 dark:bg-slate-950">
            <button type="button" onClick={() => setActiveTab("compose")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition ${activeTab === "compose" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"}`}>
              <PenLine className="h-3.5 w-3.5" /> Compose
            </button>
            <button type="button" onClick={() => setActiveTab("preview")} className={`inline-flex items-center gap-1.5 rounded-md px-3 py-2 text-xs font-semibold transition ${activeTab === "preview" ? "bg-white text-slate-900 shadow-sm dark:bg-slate-800 dark:text-slate-100" : "text-slate-500 hover:text-slate-900 dark:hover:text-slate-100"}`}>
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/60"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" /><div><p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Protected sending</p><p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">Admin authorization and rate limits.</p></div></div>
          <div className="flex gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/60"><Monitor className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" /><div><p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Gmail-style preview</p><p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">The preview uses the exact sent HTML.</p></div></div>
          <div className="flex gap-2.5 rounded-xl border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/60"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" /><div><p className="text-xs font-semibold text-slate-700 dark:text-slate-200">Everything editable</p><p className="mt-0.5 text-[11px] leading-4 text-slate-500 dark:text-slate-400">Subject, headline, body, CTA, and signature.</p></div></div>
        </div>
      </div>

      <div className="grid items-stretch gap-6 lg:grid-cols-2">
        <section className={`${activeTab === "preview" ? "hidden lg:block" : "block"} rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6`}>
          <div className="mb-5 flex items-start justify-between gap-3">
            <div><h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Message details</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Edit the content exactly as you want it delivered.</p></div>
            <Button type="button" variant="ghost" size="sm" onClick={() => resetDraft()} disabled={isSending || isSendingTest} className="gap-1.5 text-xs text-slate-500"><RotateCcw className="h-3.5 w-3.5" /> Reset</Button>
          </div>

          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2"><FieldLabel optional>Scholar name</FieldLabel><input type="text" value={draft.scholarName} onChange={(event) => updateField("scholarName", event.target.value)} placeholder="Leave blank to use Scholar" maxLength={120} autoComplete="name" className={inputClassName} /></label>
              <label className="space-y-2"><FieldLabel>Scholar email</FieldLabel><input type="email" value={draft.scholarEmail} onChange={(event) => updateField("scholarEmail", event.target.value)} placeholder="scholar@university.edu" maxLength={320} autoComplete="email" className={inputClassName} /></label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2"><FieldLabel optional>University or college</FieldLabel><input type="text" value={draft.university} onChange={(event) => updateField("university", event.target.value)} placeholder="e.g. IGNOU" maxLength={200} className={inputClassName} /></label>
              <label className="space-y-2"><FieldLabel optional>Department</FieldLabel><input type="text" value={draft.department} onChange={(event) => updateField("department", event.target.value)} placeholder="e.g. PhD Research" maxLength={200} className={inputClassName} /></label>
            </div>

            <label className="block space-y-2"><FieldHeader label="Subject line" showDefault={!draft.subject.trim()} onUseDefault={() => applyDefault("subject")} /><input type="text" value={draft.subject} onChange={(event) => updateField("subject", event.target.value)} placeholder="A Quiet Workspace for the Noisy Academic Life" maxLength={150} className={inputClassName} /></label>

            <div className="grid gap-4 sm:grid-cols-[110px_1fr]">
              <label className="space-y-2"><FieldHeader label="Greeting" showDefault={!draft.greeting.trim()} onUseDefault={() => applyDefault("greeting")} /><input type="text" value={draft.greeting} onChange={(event) => updateField("greeting", event.target.value)} placeholder="Hello" maxLength={50} className={inputClassName} /></label>
              <label className="space-y-2"><FieldHeader label="Email headline" showDefault={!draft.headline.trim()} onUseDefault={() => applyDefault("headline")} /><input type="text" value={draft.headline} onChange={(event) => updateField("headline", event.target.value)} placeholder="A Quiet Workspace for the Noisy Academic Life" maxLength={150} className={inputClassName} /></label>
            </div>

            <label className="block space-y-2"><div className="flex items-center justify-between gap-3"><FieldHeader label="Email body" showDefault={!draft.body.trim()} onUseDefault={() => applyDefault("body")} /><span className="text-[11px] text-slate-400">{draft.body.length}/8,000</span></div><textarea rows={9} value={draft.body} onChange={(event) => updateField("body", event.target.value)} placeholder="Write the complete message here..." maxLength={8000} className={`${inputClassName} resize-y leading-6`} /></label>

            {contextLine && <div className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2.5 text-xs leading-5 text-violet-900 dark:border-violet-500/20 dark:bg-violet-500/10 dark:text-violet-100"><span className="font-semibold">Automatically added:</span> {contextLine}</div>}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2"><FieldHeader label="Button text" showDefault={!draft.ctaLabel.trim()} onUseDefault={() => applyDefault("ctaLabel")} /><input type="text" value={draft.ctaLabel} onChange={(event) => updateField("ctaLabel", event.target.value)} placeholder="Visit ScholarBase" maxLength={80} className={inputClassName} /></label>
              <label className="space-y-2"><FieldHeader label="Signature name" showDefault={!draft.senderName.trim()} onUseDefault={() => applyDefault("senderName")} /><input type="text" value={draft.senderName} onChange={(event) => updateField("senderName", event.target.value)} placeholder="ScholarBase" maxLength={120} className={inputClassName} /></label>
            </div>

            <label className="block space-y-2"><FieldHeader label="Signature role" showDefault={!draft.senderRole.trim()} onUseDefault={() => applyDefault("senderRole")} /><input type="text" value={draft.senderRole} onChange={(event) => updateField("senderRole", event.target.value)} placeholder="Founder, ScholarBase" maxLength={160} className={inputClassName} /></label>
            <label className="block space-y-2"><FieldHeader label="Footer / opt-out note" optional showDefault={!draft.footerText.trim()} onUseDefault={() => applyDefault("footerText")} /><input type="text" value={draft.footerText} onChange={(event) => updateField("footerText", event.target.value)} placeholder="If you would prefer not to receive further notes, simply reply and let us know." maxLength={300} className={inputClassName} /></label>

            <div className="flex gap-2.5 rounded-xl border border-blue-100 bg-blue-50/70 p-3.5 text-xs leading-5 text-blue-900 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-100"><Info className="mt-0.5 h-4 w-4 shrink-0" /><p>The visible email copy is editable. The verified sender address and ScholarBase destination link stay fixed for trust and deliverability.</p></div>

            <div className="flex flex-col gap-3 border-t border-slate-100 pt-5 dark:border-slate-800 sm:flex-row">
              <Button type="button" variant="outline" disabled={!canSend || isSending || isSendingTest} onClick={() => void executeSend(true)} className="h-11 flex-1 gap-2 text-xs">{isSendingTest ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}{isSendingTest ? "Sending test..." : "Send test to me"}</Button>
              <Button type="button" disabled={!canSend || isSending || isSendingTest} onClick={() => setIsConfirmOpen(true)} className="h-11 flex-1 gap-2 bg-slate-900 text-xs text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"><Send className="h-4 w-4" />Send official email</Button>
            </div>
          </div>
        </section>

        <section className={`${activeTab === "compose" ? "hidden lg:flex" : "flex"} h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900`}>
          <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-800 sm:px-6"><div><h3 className="text-base font-bold text-slate-900 dark:text-slate-100">Live email preview</h3><p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Review the exact email before it leaves ScholarBase.</p></div><span className="hidden rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:bg-slate-800 dark:text-slate-400 sm:inline-flex">Gmail-style</span></div>
          <div className="border-b border-slate-200 bg-slate-50 px-5 py-3 text-xs dark:border-slate-800 dark:bg-slate-950/70 sm:px-6"><div className="space-y-1"><div><span className="text-slate-400">From:</span> <span className="font-medium text-slate-700 dark:text-slate-200">ScholarBase &lt;connect@scholarbase.app&gt;</span></div><div><span className="text-slate-400">To:</span> <span className="font-medium text-slate-700 dark:text-slate-200">{draft.scholarEmail || "recipient@university.edu"}</span></div><div><span className="text-slate-400">Subject:</span> <span className="font-medium text-slate-700 dark:text-slate-200">{draft.subject || "Only For Scholars: A Transparent Introduction to ScholarBase"}</span></div></div></div>
          <div className="min-h-[740px] flex-1 bg-slate-100 p-2 dark:bg-slate-950 sm:p-4"><iframe title="ScholarBase outreach email preview" srcDoc={previewHtml} sandbox="" className="h-full min-h-[724px] w-full rounded-lg border-0 bg-white shadow-sm" /></div>
        </section>
      </div>

      <ConfirmationModal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} onConfirm={() => void executeSend(false)} title="Send official outreach email?" message={`This will send “${draft.subject || "your message"}” to ${draft.scholarEmail || "the scholar email"}. Please review the preview first.`} isConfirming={isSending} confirmLabel="Send email" confirmingLabel="Sending email..." confirmVariant="default" />
    </div>
  );
}
