"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateProfile } from "@/app/actions/profile";

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
      className="space-y-6 bg-white p-8 rounded-2xl border shadow-sm"
    >
      {error && (
        <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Full Name
        </label>
        <input
          name="name"
          defaultValue={user.name || ""}
          required
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition"
          placeholder="e.g. Dr. Jane Smith"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Scholar Handle
        </label>
        <div className="relative">
          <span className="absolute left-4 top-3.5 text-slate-400 font-medium">
            @
          </span>
          <input
            name="handle"
            defaultValue={user.handle || ""}
            className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition"
            placeholder="janesmith"
          />
        </div>
        <p className="text-xs text-slate-500 mt-2">
          This will be your unique identifier on ScholarBase.
        </p>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Bio / About Me
        </label>
        <textarea
          name="bio"
          defaultValue={user.bio || ""}
          rows={4}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition resize-none"
          placeholder="Share your research interests, current institution, and academic goals..."
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Avatar URL (Temporary)
        </label>
        <input
          name="avatarUrl"
          defaultValue={user.avatarUrl || ""}
          className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:ring-2 focus:ring-blue-600 focus:border-transparent outline-none transition"
          placeholder="https://example.com/my-photo.jpg"
        />
      </div>

      <div className="flex justify-end pt-4">
        <button
          type="submit"
          disabled={isPending}
          className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Saving..." : "Save Profile"}
        </button>
      </div>
    </form>
  );
}
