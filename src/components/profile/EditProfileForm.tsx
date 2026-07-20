"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, isHandleAvailable as checkHandle } from "@/app/actions/profile";
import { BrandMark } from "@/components/BrandMark";

type UserData = {
  name: string | null;
  handle: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

// Simple debounce hook
function useDebounce<T extends (...args: any[]) => void>(callback: T, delay: number) {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback((...args: Parameters<T>) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    timeoutRef.current = setTimeout(() => {
      callbackRef.current(...args);
    }, delay);
  }, [delay]);
}


export default function EditProfileForm({ user }: { user: UserData }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [handle, setHandle] = useState(user.handle || "");
  const [isHandleAvailable, setIsHandleAvailable] = useState<boolean | null>(null);
  const [isHandleValid, setIsHandleValid] = useState(true);
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);

  const debouncedCheckHandle = useDebounce(async (h: string) => {
    if (h.length > 2) {
      setIsCheckingHandle(true);
      const available = await checkHandle(h);
      setIsHandleAvailable(available);
      setIsCheckingHandle(false);
    } else {
      setIsHandleAvailable(null);
    }
  }, 500);

  useEffect(() => {
    const regex = /^[a-zA-Z0-9_]+$/;
    const isValid = regex.test(handle) || handle === "";
    setIsHandleValid(isValid);

    if (isValid && handle !== user.handle) {
      debouncedCheckHandle(handle);
    } else {
      setIsHandleAvailable(null);
    }
  }, [handle, user.handle, debouncedCheckHandle]);


  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);

    try {
      const result = await updateProfile(formData);

      if (result?.success) {
        // updateProfile currently only returns { success, message }
        // Redirect back to their profile page after a successful save.
        router.refresh();
      } else {
        setError(result?.message || "Failed to update profile.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update profile.");
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form
      action={handleSubmit}
      className="sb-surface-strong space-y-6 p-8 md:p-10"
    >
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

      <div>
        <label className="sb-label">Full Name</label>
        <input
          name="name"
          defaultValue={user.name || ""}
          required
          className="sb-input"
          placeholder="e.g. Dr. Jane Smith"
        />
      </div>

      <div>
        <label className="sb-label">Scholar Handle</label>
        <div className="relative">
          <span className="absolute left-4 top-3.5 font-medium text-slate-400">
            @
          </span>
          <input
            name="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className={`sb-input pl-9 ${
              !isHandleValid
                ? "border-red-500"
                : isHandleAvailable === true
                ? "border-green-500"
                : isHandleAvailable === false
                ? "border-red-500"
                : ""
            }`}
            placeholder="janesmith"
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Only letters, numbers, and underscores are allowed.
        </p>
        {!isHandleValid && (
          <p className="mt-2 text-xs text-red-500">
            Invalid characters in handle.
          </p>
        )}
        {isCheckingHandle && (
          <p className="mt-2 text-xs text-slate-500">Checking availability...</p>
        )}
        {isHandleAvailable !== null && !isCheckingHandle && (
          <p
            className={`mt-2 text-xs ${
              isHandleAvailable ? "text-green-500" : "text-red-500"
            }`}
          >
            {isHandleAvailable ? "Handle is available!" : "Handle is already taken."}
          </p>
        )}
      </div>

      <div>
        <label className="sb-label">Bio / About Me</label>
        <textarea
          name="bio"
          defaultValue={user.bio || ""}
          rows={4}
          className="sb-input resize-none"
          placeholder="Share your research interests, current institution, and academic goals..."
        />
      </div>

      <div>
        <label className="sb-label">Avatar URL (Temporary)</label>
        <input
          name="avatarUrl"
          defaultValue={user.avatarUrl || ""}
          className="sb-input"
          placeholder="https://example.com/my-photo.jpg"
        />
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isPending || !isHandleValid || isCheckingHandle || isHandleAvailable === false}
          className="sb-button-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </form>
  );
}
