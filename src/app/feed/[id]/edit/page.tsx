"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateSocialPost } from "@/app/actions/feed";
import { generateCloudinarySignature } from "@/app/actions/cloudinary";
import { useToast } from "@/components/ui/Toast";
import { SubmitBtn } from "@/components/ui/SubmitBtn";

export default function EditPostPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [postId, setPostId] = useState<string | null>(null);
  const router = useRouter();
  const { toast } = useToast();
  const formRef = useRef<HTMLFormElement>(null);
  const [content, setContent] = useState("");
  const [existingImageUrls, setExistingImageUrls] = useState<string[]>([]);
  const [newImageUrls, setNewImageUrls] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function init() {
      const { id } = await params;
      setPostId(id);

      try {
        const res = await fetch(`/api/feed/${id}/edit-data`);
        if (!res.ok) throw new Error("Not found");
        const data = await res.json();
        setContent(data.content || "");
        setExistingImageUrls(data.imageUrls || []);
      } catch {
        toast("Failed to load post.", "error");
        router.push("/feed");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, [params, router, toast]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("image/")) continue;
        if (file.size > 5 * 1024 * 1024) {
          toast("Each image must be less than 5MB.", "error");
          continue;
        }

        const { timestamp, signature, apiKey, cloudName, folder } =
          await generateCloudinarySignature();

        const fd = new FormData();
        fd.append("file", file);
        fd.append("api_key", apiKey);
        fd.append("timestamp", String(timestamp));
        fd.append("signature", signature);
        fd.append("folder", folder);

        const res = await fetch(
          `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
          { method: "POST", body: fd },
        );

        if (!res.ok) throw new Error("Upload failed");
        const data = await res.json();
        setNewImageUrls((prev) => [...prev, data.secure_url]);
      }
    } catch {
      toast("Failed to upload image(s).", "error");
    } finally {
      setUploading(false);
    }
  };

  const removeExistingImage = (index: number) => {
    setExistingImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const removeNewImage = (index: number) => {
    setNewImageUrls((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!postId) return;

    if (uploading) {
      toast("Please wait for images to finish uploading.", "error");
      return;
    }

    if (!content.trim()) {
      toast("Post content cannot be empty.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const allImageUrls = [...existingImageUrls, ...newImageUrls];
      const formData = new FormData();
      formData.append("content", content);
      allImageUrls.forEach((url) => formData.append("imageUrls", url));

      await updateSocialPost(formData, postId);
      toast("Post updated successfully!", "success");
      router.push(`/feed/${postId}`);
    } catch (err: any) {
      toast(err?.message || "Failed to update post.", "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto max-w-2xl py-12 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-center py-20">
          <svg
            className="animate-spin h-8 w-8 text-blue-600"
            viewBox="0 0 24 24"
            fill="none"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
            />
          </svg>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl py-12 px-4 sm:px-6 lg:px-8">
      <div className="mb-8">
        <Link
          href={`/feed/${postId}`}
          className="mb-6 inline-flex items-center text-sm font-medium text-slate-500 transition-colors hover:text-blue-700"
        >
          ← Cancel and Back to Post
        </Link>
        <h1 className="text-3xl font-semibold tracking-tight text-slate-950">
          Edit Post
        </h1>
      </div>

      <form
        ref={formRef}
        onSubmit={handleSubmit}
        className="sb-surface-strong p-6 md:p-8 flex flex-col gap-4"
      >
        <div>
          <label className="sb-label mb-2 block">Post Content</label>
          <textarea
            name="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            required
            rows={6}
            className="w-full p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-900 resize-y"
            placeholder="What's on your mind?"
          />
        </div>

        {/* Existing Images */}
        {existingImageUrls.length > 0 && (
          <div>
            <label className="sb-label mb-2 block">Current Images</label>
            <div className="flex flex-wrap gap-2">
              {existingImageUrls.map((url, i) => (
                <div key={`existing-${i}`} className="relative group">
                  <img
                    src={url}
                    alt=""
                    className="h-20 w-20 rounded-lg object-cover border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeExistingImage(i)}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Newly Uploaded Images */}
        {newImageUrls.length > 0 && (
          <div>
            <label className="sb-label mb-2 block">New Images</label>
            <div className="flex flex-wrap gap-2">
              {newImageUrls.map((url, i) => (
                <div key={`new-${i}`} className="relative group">
                  <img
                    src={url}
                    alt=""
                    className="h-20 w-20 rounded-lg object-cover border border-slate-200"
                  />
                  <button
                    type="button"
                    onClick={() => removeNewImage(i)}
                    className="absolute -top-1.5 -right-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-white text-xs font-bold hover:bg-red-600"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 transition">
            <svg
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            {uploading ? "Uploading..." : "Add Images"}
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileUpload}
              disabled={uploading}
            />
          </label>
          <button
            type="submit"
            disabled={submitting || uploading}
            className="sb-button-accent"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <svg
                  className="animate-spin h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </button>
        </div>
      </form>
    </main>
  );
}
