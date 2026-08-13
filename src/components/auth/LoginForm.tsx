"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useToast } from "@/components/ui/Toast";
import { login, signup, signInWithGoogle } from "@/app/actions/auth";
import { BrandMark } from "@/components/BrandMark";
import { ForgotPasswordForm } from "@/components/auth/ForgotPasswordForm";

export function LoginForm({ returnUrl }: { returnUrl: string }) {
  const searchParams = useSearchParams();
  const message = searchParams.get("message");
  const { toast } = useToast();

  useEffect(() => {
    if (message) {
      toast({
        title: "Success",
        description: message,
      });
    }
  }, [message, toast]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6">
      <div className="sb-surface w-full max-w-md space-y-6 p-8 md:p-10">
        <div className="text-center">
          <div className="mx-auto mb-4 inline-flex rounded-full border border-blue-200 bg-blue-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.24em] text-blue-700 dark:border-blue-400/20 dark:bg-blue-400/10 dark:text-blue-200">
            Sign In
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-slate-950 dark:text-slate-50">
            Welcome to <BrandMark className="inline-flex items-center gap-1" />
          </h1>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Sign in to your account or register a new one
          </p>
        </div>

        <form action={signInWithGoogle.bind(null, returnUrl)}>
          <button className="sb-button-soft w-full gap-2">
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              Or continue with email
            </span>
          </div>
        </div>

        <form className="flex flex-col gap-4" action={login}>
          <input type="hidden" name="callbackUrl" value={returnUrl} />

          <div>
            <label className="sb-label" htmlFor="email">
              Email
            </label>
            <input
              className="sb-input"
              id="email"
              name="email"
              type="email"
              placeholder="scholar@university.edu"
              required
            />
          </div>

          <div>
            <label className="sb-label" htmlFor="password">
              Password
            </label>
            <input
              className="sb-input"
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
            />
          </div>

          <div className="flex gap-4 mt-2">
            <button type="submit" className="sb-button-primary w-full">
              Sign In
            </button>
            <button formAction={signup} className="sb-button-soft w-full">
              Register
            </button>
          </div>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-200 dark:border-slate-800" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="bg-white px-2 text-slate-500 dark:bg-slate-950 dark:text-slate-400">
              Set or Reset Password
            </span>
          </div>
        </div>

        <p className="-mb-2 text-center text-sm text-slate-600 dark:text-slate-400">
          Forgot your password? Or want to set a password for your account
          continued with Google? Enter your email to get a recovery link.
        </p>

        <ForgotPasswordForm callbackUrl={returnUrl} />
      </div>
    </main>
  );
}
