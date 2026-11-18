"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ImagePlus, X, Loader2 } from "lucide-react";
import BrandMark from "@/components/BrandMark";
import { API_URL } from "@/lib/api";

const navy = "#0B1F3A";
const orange = "#FF7900";

// Four is deliberate: it grids cleanly on a phone, and students on mobile
// data should not be uploading more. The server enforces it too.
const MAX_IMAGES = 4;
const MAX_BYTES = 5 * 1024 * 1024;

// PHP rejects the whole request if the combined upload is over post_max_size,
// and it does so silently — the request simply arrives empty. Catching it
// here means a clear message instead of a mystery failure.
const MAX_TOTAL_BYTES = 18 * 1024 * 1024;

const TOKEN_KEY = "campus_life_token";

type Picked = {
  id: string;
  file: File;
  url: string;
};

function readToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    // Private browsing can block localStorage entirely.
    return null;
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 60000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function formatSize(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function CreatePostPage() {
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);

  const [content, setContent] = useState("");
  const [images, setImages] = useState<Picked[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Object URLs are held by the browser until revoked. Without this, every
  // photo you preview and then leave behind leaks memory.
  const imagesRef = useRef<Picked[]>([]);
  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((p) => URL.revokeObjectURL(p.url));
    };
  }, []);

  const totalBytes = images.reduce((sum, p) => sum + p.file.size, 0);

  function addFiles(list: FileList | null) {
    if (!list || list.length === 0) return;

    const incoming = Array.from(list);
    const room = MAX_IMAGES - images.length;

    if (room <= 0) {
      setError(`You can add up to ${MAX_IMAGES} photos.`);
      resetInput();
      return;
    }

    const accepted: Picked[] = [];
    const problems: string[] = [];

    for (const file of incoming.slice(0, room)) {
      if (!file.type.startsWith("image/")) {
        problems.push(`${file.name} is not an image.`);
        continue;
      }
      if (file.size > MAX_BYTES) {
        problems.push(`${file.name} is ${formatSize(file.size)} — the limit is 5 MB each.`);
        continue;
      }
      accepted.push({
        // crypto.randomUUID isn't available on older phone browsers.
        id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
        file,
        url: URL.createObjectURL(file),
      });
    }

    if (incoming.length > room) {
      problems.push(`Only the first ${room} ${room === 1 ? "photo was" : "photos were"} added — the limit is ${MAX_IMAGES}.`);
    }

    const nextTotal = totalBytes + accepted.reduce((sum, p) => sum + p.file.size, 0);
    if (nextTotal > MAX_TOTAL_BYTES) {
      accepted.forEach((p) => URL.revokeObjectURL(p.url));
      setError(
        `Those photos come to ${formatSize(nextTotal)} together, which is too much for one upload. Remove one or pick smaller photos.`,
      );
      resetInput();
      return;
    }

    if (accepted.length) setImages((current) => [...current, ...accepted]);
    setError(problems.join(" "));
    resetInput();
  }

  function resetInput() {
    // Clearing the value lets you pick the same file again after removing it.
    if (fileInput.current) fileInput.current.value = "";
  }

  function removeImage(id: string) {
    setImages((current) => {
      const gone = current.find((p) => p.id === id);
      if (gone) URL.revokeObjectURL(gone.url);
      return current.filter((p) => p.id !== id);
    });
    setError("");
  }

  async function publishPost(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setError("");

    const token = readToken();
    if (!token) {
      setError("Please log in before creating a post.");
      return;
    }

    const text = content.trim();
    if (!text) {
      setError("Write something about your campus first.");
      return;
    }

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("content", text);

      // images[] is what Laravel reads as an array. Order is preserved, so
      // the first photo becomes the post's cover.
      images.forEach((p) => formData.append("images[]", p.file));

      const response = await fetchWithTimeout(`${API_URL}/posts`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Your session has expired. Please log in again.");
        }
        if (response.status === 413) {
          throw new Error("Those photos are too large for the server. Try fewer or smaller ones.");
        }

        const validationMessage = data.errors
          ? Object.values(data.errors).flat().join(" ")
          : data.message;

        throw new Error(validationMessage || "Could not publish your post.");
      }

      router.push("/");
      router.refresh();
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      setError(
        timedOut
          ? "The upload took too long. Check your connection and try again — large photos on slow data can time out."
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  const canAddMore = images.length < MAX_IMAGES;

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-50 px-4 py-6 text-slate-900 sm:py-10">
      <div className="mx-auto w-full max-w-2xl">
        <header className="mb-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={40} className="shrink-0 rounded-xl" />
            <span className="text-xl font-extrabold tracking-tight" style={{ color: navy }}>
              Campus <span style={{ color: orange }}>Plus</span>
            </span>
          </Link>

          <Link
            href="/"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold transition hover:bg-slate-50"
          >
            Cancel
          </Link>
        </header>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <h1 className="text-2xl font-extrabold" style={{ color: navy }}>
            Create a post
          </h1>

          <p className="mt-2 text-sm text-slate-500">
            Share something with students on Campus Plus.
          </p>

          <form onSubmit={publishPost} className="mt-6 space-y-5">
            <div>
              <label htmlFor="post-content" className="mb-2 block text-sm font-bold">
                What&apos;s happening on your campus?
              </label>

              <textarea
                id="post-content"
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="Share an update, ask a question, or start a conversation..."
                maxLength={5000}
                rows={7}
                required
                className="block w-full min-w-0 max-w-full resize-y break-words rounded-xl border border-slate-200 bg-slate-50 p-4 text-base leading-6 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 sm:text-sm"
              />

              <p className="mt-2 text-right text-xs text-slate-400">
                {content.length}/5000
              </p>
            </div>

            <div>
              {/* `multiple` is what lets the gallery picker select several at
                  once; the handler also appends, so you can add a few, then
                  tap again and add a few more. */}
              <input
                ref={fileInput}
                type="file"
                multiple
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(event) => addFiles(event.target.files)}
              />

              {images.length > 0 && (
                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {images.map((picked, index) => (
                    <div
                      key={picked.id}
                      className="group relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={picked.url}
                        alt={`Selected photo ${index + 1}`}
                        className="h-full w-full object-cover"
                      />

                      {index === 0 && (
                        <span
                          className="absolute left-1.5 top-1.5 rounded-full px-2 py-0.5 text-[10px] font-extrabold text-[#0B1F3A]"
                          style={{ backgroundColor: orange }}
                        >
                          Cover
                        </span>
                      )}

                      <button
                        type="button"
                        onClick={() => removeImage(picked.id)}
                        aria-label={`Remove photo ${index + 1}`}
                        className="absolute right-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-slate-900/70 text-white transition hover:bg-slate-900"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {canAddMore && (
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 px-4 py-4 text-sm font-semibold transition hover:bg-slate-50"
                  style={{ color: navy }}
                >
                  <ImagePlus size={19} strokeWidth={1.8} />
                  {images.length === 0
                    ? "Add photos"
                    : `Add more (${images.length}/${MAX_IMAGES})`}
                </button>
              )}

              <p className="mt-2 text-xs text-slate-500">
                JPG, PNG or WebP · up to {MAX_IMAGES} photos · 5 MB each
                {images.length > 0 && ` · ${formatSize(totalBytes)} selected`}
              </p>

              {images.length > 1 && (
                <p className="mt-1 text-xs text-slate-400">
                  The first photo is the cover. Remove and re-add to change the order.
                </p>
              )}
            </div>

            {error && (
              <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !content.trim()}
              className="flex w-full items-center justify-center gap-2 rounded-full px-5 py-3 font-bold text-[#0B1F3A] transition disabled:cursor-not-allowed disabled:opacity-60"
              style={{ backgroundColor: orange }}
            >
              {loading && <Loader2 size={18} className="animate-spin" />}
              {loading
                ? images.length > 0
                  ? "Uploading photos..."
                  : "Publishing..."
                : "Publish post"}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}