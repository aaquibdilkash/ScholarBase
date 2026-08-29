import Link from "next/link";

export default function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="border-t border-white/70 bg-white/70 backdrop-blur-xl dark:border-slate-800/80 dark:bg-slate-950/85 md:sticky md:bottom-0">
      <div className="sb-shell flex flex-col items-center justify-between gap-3 py-3 sm:flex-row">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          &copy; {currentYear} ScholarBase. All rights reserved.
        </p>
        <nav className="flex items-center gap-6">
          <Link
            href="/privacy"
            className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Privacy Policy
          </Link>
          <Link
            href="/terms"
            className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Terms of Service
          </Link>
          <Link
            href="/contact"
            className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Contact Us
          </Link>
          <Link
            href="/about"
            className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            About Us
          </Link>
          <Link
            href="/careers"
            className="text-sm text-slate-500 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            Careers
          </Link>
        </nav>
      </div>
    </footer>
  );
}
