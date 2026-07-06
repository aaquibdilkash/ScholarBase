"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/actions/profile";
import { BrandMark } from "@/components/BrandMark";

type UserData = {
  name: string | null;
  handle: string | null;
  bio: string | null;
  avatarUrl: string | null;
};

export default function EditProfileForm({ user }: { user: UserData }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(formData: FormData) {
    setIsPending(true);
    setError(null);

    const result = await updateProfile(formData);

    if (result?.error) {
      setError(result.error);
      setIsPending(false);
    } else if (result?.success) {
      // Redirect back to their profile page
      router.push(`/scholar/${result.userId}`);
      router.refresh();
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
            defaultValue={user.handle || ""}
            className="sb-input pl-9"
            placeholder="janesmith"
          />
        </div>
        <p className="mt-2 text-xs text-slate-500">
          This will be your unique identifier on{" "}
          <BrandMark className="font-semibold" />.
        </p>
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
          disabled={isPending}
          className="sb-button-accent disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </form>
  );
}
