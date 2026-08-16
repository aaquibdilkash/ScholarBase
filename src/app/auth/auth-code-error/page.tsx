import type { Metadata } from "next";
import { buildNoindexMetadata } from "@/lib/seo";

export const metadata: Metadata = buildNoindexMetadata("Authentication - ScholarBase");

export default function AuthCodeError() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
      <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow-md w-full max-w-md">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Authentication Error</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            There was a problem authenticating your request.
          </p>
        </div>
        <div className="mt-6">
          <p className="text-center text-gray-800 dark:text-gray-200">The link you used may have expired or been used already. Please try
            requesting a new password reset link.</p>
        </div>
      </div>
    </div>
  );
}

