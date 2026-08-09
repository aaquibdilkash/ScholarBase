import { ContactForm } from "@/components/contact/ContactForm";
import { Clock, Mail, Send } from "lucide-react";

export const metadata = {
  title: "Contact Us",
  description:
    "Get in touch with the ScholarBase team for business inquiries, platform support, and general questions.",
};

export default function ContactPage() {
  return (
    <main className="min-h-screen py-12 sm:py-16 md:py-20">
      <div className="sb-shell">
        <div className="mx-auto max-w-2xl">
          <div className="text-center mb-10 sm:mb-12">
            <h1 className="text-3xl sm:text-4xl font-bold text-slate-950 dark:text-slate-50 mb-3 sm:mb-4">
              Get in Touch
            </h1>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-400 mb-6">
              Have a question or want to work with us? We&apos;d love to hear
              from you.
            </p>
            <div className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:px-6 sm:py-4 dark:border-slate-800 dark:bg-slate-900">
              <Mail className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              <div className="text-left">
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-0.5">
                  Email us at
                </p>
                <a
                  href="mailto:connect@scholarbase.app"
                  className="text-sm sm:text-base font-semibold text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                >
                  connect@scholarbase.app
                </a>
              </div>
            </div>
            <p className="mt-4 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              For business partnerships, platform inquiries, and general support
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 sm:p-8 md:p-10 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-xl sm:text-2xl font-semibold text-slate-900 dark:text-slate-100 mb-2">
              Send us a Message
            </h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-6 sm:mb-8">
              Fill out the form below and we&apos;ll get back to you within
              24-48 hours.
            </p>

            <ContactForm />
          </div>

          <div className="mt-8 sm:mt-10 grid gap-4 sm:gap-6 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Send className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  Email
                </h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                connect@scholarbase.app
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3 mb-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                  <Clock className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="font-semibold text-slate-900 dark:text-slate-100">
                  Response Time
                </h3>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Within 24-48 hours
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
