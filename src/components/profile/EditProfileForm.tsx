"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  updateProfile,
  isHandleAvailable as checkHandle,
} from "@/app/actions/profile";
import { generateAvatarSignature } from "@/app/actions/cloudinary";
import { useToast } from "@/components/ui/Toast";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { Editor } from "@/components/ui/Editor";

type UserData = {
  id: string;
  name: string | null;
  handle: string | null;
  bio: string | null;
  avatarUrl: string | null;
  githubUrl: string | null;
  orcidUrl: string | null;
  linkedinUrl: string | null;
  googleScholarUrl: string | null;
};

// Simple debounce hook
function useDebounce<A extends unknown[]>(
  callback: (...args: A) => void,
  delay: number,
) {
  const callbackRef = useRef(callback);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  return useCallback(
    (...args: A) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      timeoutRef.current = setTimeout(() => {
        callbackRef.current(...args);
      }, delay);
    },
    [delay],
  );
}

export default function EditProfileForm({ user }: { user: UserData }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [handle, setHandle] = useState(user.handle || "");
  const [isHandleAvailable, setIsHandleAvailable] = useState<boolean | null>(
    null,
  );
  const [isHandleValid, setIsHandleValid] = useState(true);
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const { toast } = useToast();

  const [bio, setBio] = useState(user.bio || "");

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

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Please upload an image file.");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setUploadError("File size must be less than 5MB.");
      return;
    }

    setUploading(true);
    setUploadError("");

    try {
      const { timestamp, signature, apiKey, cloudName, folder } =
        await generateAvatarSignature();

      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", apiKey);
      formData.append("timestamp", String(timestamp));
      formData.append("signature", signature);
      formData.append("folder", folder);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: formData },
      );

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Upload failed");
      }

      const data = await res.json();
      setAvatarUrl(data.secure_url);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to upload avatar.";
      setUploadError(message);
    } finally {
      setUploading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await updateProfile(formData);

      if (result?.success) {
        toast("Profile updated successfully!", "success");
        router.push(`/scholars/${user.id}`);
      } else {
        const msg = result?.message || "Failed to update profile.";
        setError(msg);
        toast(msg, "error");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to update profile.";
      setError(msg);
      toast(msg, "error");
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
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
          <p className="mt-2 text-xs text-slate-500">
            Checking availability...
          </p>
        )}
        {isHandleAvailable !== null && !isCheckingHandle && (
          <p
            className={`mt-2 text-xs ${
              isHandleAvailable ? "text-green-500" : "text-red-500"
            }`}
          >
            {isHandleAvailable
              ? "Handle is available!"
              : "Handle is already taken."}
          </p>
        )}
      </div>

      <div>
        <label className="sb-label">Bio / About Me</label>
        <Editor value={bio} onChange={(data) => setBio(data)} />
        <input type="hidden" name="bio" value={bio} />
      </div>

      <div>
        <label className="sb-label">Avatar</label>
        <div className="mt-1 flex items-center gap-4">
          {avatarUrl && (
            <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-slate-200 shrink-0">
              <Image
                src={avatarUrl}
                alt="Avatar preview"
                width={64}
                height={64}
                unoptimized
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <label className="cursor-pointer rounded-lg border-2 border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm font-medium text-slate-600 transition hover:border-blue-400 hover:bg-blue-50">
            <span>{uploading ? "Uploading..." : "Choose Image"}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={uploading}
            />
          </label>
          {avatarUrl && (
            <span className="text-xs text-green-600 font-semibold">
              ✓ Avatar uploaded
            </span>
          )}
        </div>
        {uploadError && (
          <p className="mt-1 text-xs text-red-500 font-medium">{uploadError}</p>
        )}
        <p className="mt-2 text-xs text-slate-500">
          Upload a profile photo. Recommended: square image, max 5MB.
        </p>
        <input type="hidden" name="avatarUrl" value={avatarUrl} />
      </div>

      <div>
        <label className="sb-label">Profile Links</label>
        <p className="mb-4 text-sm text-slate-500">
          Add your academic and professional profile links to be shown on your
          profile page.
        </p>
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              GitHub Profile URL
            </label>
            <input
              name="githubUrl"
              defaultValue={user.githubUrl || ""}
              className="sb-input"
              placeholder="https://github.com/janesmith"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              ORCID Profile URL
            </label>
            <input
              name="orcidUrl"
              defaultValue={user.orcidUrl || ""}
              className="sb-input"
              placeholder="https://orcid.org/0000-0001-2345-6789"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              LinkedIn Profile URL
            </label>
            <input
              name="linkedinUrl"
              defaultValue={user.linkedinUrl || ""}
              className="sb-input"
              placeholder="https://www.linkedin.com/in/janesmith"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Google Scholar Profile URL
            </label>
            <input
              name="googleScholarUrl"
              defaultValue={user.googleScholarUrl || ""}
              className="sb-input"
              placeholder="https://scholar.google.com/citations?user=..."
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <SubmitBtnWithAuth className="sb-button-accent">
          Save Profile
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
