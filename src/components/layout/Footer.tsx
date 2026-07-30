import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/70 bg-white/70 backdrop-blur-xl md:sticky md:bottom-0">
      <div className="sb-shell flex flex-col items-center justify-between gap-3 py-3 sm:flex-row">
        <p className="text-sm text-slate-500">
          &copy; {currentYear} ScholarBase. All rights reserved.
        </p>
        <nav className="flex items-center gap-6">
          <Link
            href="/privacy"
            className="text-sm text-slate-500 transition hover:text-slate-900"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="text-sm text-slate-500 transition hover:text-slate-900"
          >
            Terms of Service
          </Link>
        </nav>
      </div>
    </footer>
  );
}
