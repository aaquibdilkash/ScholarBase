"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  updateProfile,
  isHandleAvailable as checkHandle,
} from "@/app/actions/profile";
import { ImageUploadField } from "@/components/upload/ImageUploadField";
import { FormCancelButton } from "@/components/ui/FormCancelButton";
import { useToast } from "@/components/ui/Toast";
import { SubmitBtnWithAuth } from "@/components/ui/SubmitBtnWithAuth";
import { Editor } from "@/components/ui/Editor";

import {
  MAX_PROFILE_NAME,
  MAX_PROFILE_HANDLE,
  MAX_PROFILE_BIO,
  MAX_PROFILE_URL,
} from "@/lib/constants";
import { getRichTextLength } from "@/lib/html";
import { InfoTooltip } from "@/components/ui/InfoTooltip";
import {
  PROFILE_NAME_TIP,
  PROFILE_HANDLE_TIP,
  PROFILE_BIO_TIP,
  PROFILE_AVATAR_TIP,
  PROFILE_GITHUB_TIP,
  PROFILE_ORCID_TIP,
  PROFILE_LINKEDIN_TIP,
  PROFILE_GOOGLE_SCHOLAR_TIP,
} from "@/constants/tooltips";

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
  const [name, setName] = useState(user.name || "");
  const [handle, setHandle] = useState(user.handle || "");
  const [githubUrl, setGithubUrl] = useState(user.githubUrl || "");
  const [orcidUrl, setOrcidUrl] = useState(user.orcidUrl || "");
  const [linkedinUrl, setLinkedinUrl] = useState(user.linkedinUrl || "");
  const [googleScholarUrl, setGoogleScholarUrl] = useState(
    user.googleScholarUrl || "",
  );
  const [isHandleAvailable, setIsHandleAvailable] = useState<boolean | null>(
    null,
  );
  const [isHandleValid, setIsHandleValid] = useState(true);
  const [isCheckingHandle, setIsCheckingHandle] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState(user.avatarUrl || "");
  const [submitting, setSubmitting] = useState(false);

  // Persist the pending draft avatar across navigation (the asset lives in
  // the user's Cloudinary draft folder until Save promotes it). Restored on
  // mount so returning to the form shows the draft instead of the published
  // avatar, and the replace-cleanup deletes the previous draft correctly.
  const avatarDraftKey = `draft_profile_avatar_${user.id}`;
  const [avatarRestored, setAvatarRestored] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(avatarDraftKey);
      if (saved) setAvatarUrl(saved);
    } catch {
      // ignore storage errors
    }
    setAvatarRestored(true);
  }, [avatarDraftKey]);

  useEffect(() => {
    if (!avatarRestored) return;
    try {
      if (avatarUrl) localStorage.setItem(avatarDraftKey, avatarUrl);
      else localStorage.removeItem(avatarDraftKey);
    } catch {
      // ignore storage errors
    }
  }, [avatarUrl, avatarRestored, avatarDraftKey]);
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

  const isBioOverLimit = getRichTextLength(bio) > MAX_PROFILE_BIO;
  const isFormOverLimit = isBioOverLimit;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isFormOverLimit) {
      setError(`Bio exceeds the ${MAX_PROFILE_BIO}-character limit.`);
      return;
    }
    setError(null);
    setSubmitting(true);

    try {
      const formData = new FormData(e.currentTarget);
      const result = await updateProfile(formData);

      if (result?.success) {
        // The draft avatar was promoted server-side — the pending store must
        // not restore the stale draft URL on the next visit.
        try {
          localStorage.removeItem(avatarDraftKey);
        } catch {
          // ignore storage errors
        }
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
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-6 px-0 py-4 sm:px-0 sm:py-6 md:px-0 md:py-8"
    >
      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
          {error}
        </div>
      )}

       <div>
         <label className="sb-label !mb-1 inline-flex items-center gap-1.5">
           Full Name
           <InfoTooltip message={PROFILE_NAME_TIP} />
         </label>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="sb-input px-3 py-2 sm:px-3 sm:py-2"
          placeholder="e.g. Dr. Jane Smith"
          maxLength={MAX_PROFILE_NAME}
        />
        <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {name.length}/{MAX_PROFILE_NAME} characters
        </div>
      </div>

       <div>
         <label className="sb-label !mb-1 inline-flex items-center gap-1.5">
           Scholar Handle
           <InfoTooltip message={PROFILE_HANDLE_TIP} />
         </label>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-medium text-slate-400">
            @
          </span>
          <input
            name="handle"
            value={handle}
            onChange={(e) => setHandle(e.target.value)}
            className={`sb-input px-3 py-2 !pl-9 sm:px-3 sm:py-2 ${
              !isHandleValid
                ? "border-red-500"
                : isHandleAvailable === true
                  ? "border-green-500"
                  : isHandleAvailable === false
                    ? "border-red-500"
                    : ""
            }`}
            placeholder="janesmith"
            maxLength={MAX_PROFILE_HANDLE}
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Only letters, numbers, and underscores are allowed.
        </p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          {handle.length}/{MAX_PROFILE_HANDLE} characters
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
         <label className="sb-label !mb-1 inline-flex items-center gap-1.5">
           Bio / About Me
           <InfoTooltip message={PROFILE_BIO_TIP} />
         </label>
        <Editor
          maxLength={MAX_PROFILE_BIO}
          value={bio}
          onChange={(data) => setBio(data)}
        />
        <input type="hidden" name="bio" value={bio} />
      </div>

       <div className="border-t border-slate-200/70 pt-6 dark:border-slate-800">
         <label className="sb-label !mb-1 inline-flex items-center gap-1.5">
           Avatar
           <InfoTooltip message={PROFILE_AVATAR_TIP} />
         </label>
        <div className="mt-1">
          <ImageUploadField
            kind="avatar"
            crop
            circular
            previewSize={64}
            value={avatarUrl}
            onChange={setAvatarUrl}
            buttonLabel={avatarUrl ? "Replace Avatar" : "Choose Image"}
            buttonVariant="dashed"
            successHint="✓ Avatar uploaded — click Save Profile to apply"
            hint="You can crop and zoom after choosing. Removing the avatar clears it when you save. Max 5MB."
          />
        </div>
        <input type="hidden" name="avatarUrl" value={avatarUrl} />
      </div>

      <div className="border-t border-slate-200/70 pt-6 dark:border-slate-800">
        <label className="sb-label !mb-1">Profile Links</label>
        <p className="mb-4 text-sm text-slate-500">
          Add your academic and professional profile links to be shown on your
          profile page.
        </p>
        <div className="space-y-4">
           <div>
             <label className="mb-1 block text-xs font-semibold text-slate-600 inline-flex items-center gap-1.5">
               GitHub Profile URL
               <InfoTooltip message={PROFILE_GITHUB_TIP} />
             </label>
            <input
              name="githubUrl"
              value={githubUrl}
              onChange={(e) => setGithubUrl(e.target.value)}
              className="sb-input px-3 py-2 sm:px-3 sm:py-2"
              placeholder="https://github.com/janesmith"
              maxLength={MAX_PROFILE_URL}
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {githubUrl.length}/{MAX_PROFILE_URL} characters
            </div>
          </div>
           <div>
             <label className="mb-1 block text-xs font-semibold text-slate-600 inline-flex items-center gap-1.5">
               ORCID Profile URL
               <InfoTooltip message={PROFILE_ORCID_TIP} />
             </label>
            <input
              name="orcidUrl"
              value={orcidUrl}
              onChange={(e) => setOrcidUrl(e.target.value)}
              className="sb-input px-3 py-2 sm:px-3 sm:py-2"
              placeholder="https://orcid.org/0000-0001-2345-6789"
              maxLength={MAX_PROFILE_URL}
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {orcidUrl.length}/{MAX_PROFILE_URL} characters
            </div>
          </div>
           <div>
             <label className="mb-1 block text-xs font-semibold text-slate-600 inline-flex items-center gap-1.5">
               LinkedIn Profile URL
               <InfoTooltip message={PROFILE_LINKEDIN_TIP} />
             </label>
            <input
              name="linkedinUrl"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className="sb-input px-3 py-2 sm:px-3 sm:py-2"
              placeholder="https://www.linkedin.com/in/janesmith"
              maxLength={MAX_PROFILE_URL}
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {linkedinUrl.length}/{MAX_PROFILE_URL} characters
            </div>
          </div>
           <div>
             <label className="mb-1 block text-xs font-semibold text-slate-600 inline-flex items-center gap-1.5">
               Google Scholar Profile URL
               <InfoTooltip message={PROFILE_GOOGLE_SCHOLAR_TIP} />
             </label>
            <input
              name="googleScholarUrl"
              value={googleScholarUrl}
              onChange={(e) => setGoogleScholarUrl(e.target.value)}
              className="sb-input px-3 py-2 sm:px-3 sm:py-2"
              placeholder="https://scholar.google.com/citations?user=..."
              maxLength={MAX_PROFILE_URL}
            />
            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {googleScholarUrl.length}/{MAX_PROFILE_URL} characters
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <FormCancelButton />
        <SubmitBtnWithAuth className="sb-button-accent" disabled={submitting || isFormOverLimit} loadingText="Saving...">
          Save Profile
        </SubmitBtnWithAuth>
      </div>
    </form>
  );
}
