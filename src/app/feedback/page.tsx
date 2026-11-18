"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bug, Lightbulb, MessageSquare, CheckCircle2 } from "lucide-react";

import BrandMark from "@/components/BrandMark";
import { API_URL } from "@/lib/api";

const navy = "#0B1F3A";
const orange = "#FF7900";

const TYPES = [
  { id: "bug", label: "Something's broken", Icon: Bug },
  { id: "idea", label: "I have an idea", Icon: Lightbulb },
  { id: "other", label: "Something else", Icon: MessageSquare },
] as const;

const PLACEHOLDERS: Record<string, string> = {
  bug: "What were you doing when it broke? What did you expect to happen, and what happened instead?",
  idea: "What would you like Campus Plus to do? What problem would it solve for you?",
  other: "Tell us what's on your mind.",
};

function readToken() {
  try {
    return window.localStorage.getItem("campus_life_token");
  } catch {
    return null;
  }
}

export default function FeedbackPage() {
  const [type, setType] = useState<string>("bug");
  const [message, setMessage] = useState("");
  const [page, setPage] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  // Most people arrive here straight from the page that annoyed them, so fill
  // it in for them. A bug report without a page is usually unreproducible.
  useEffect(() => {
    try {
      const referrer = document.referrer;
      if (!referrer) return;
      const url = new URL(referrer);
      if (url.origin === window.location.origin && url.pathname !== "/feedback") {
        setPage(url.pathname);
      }
    } catch {
      // A missing or odd referrer just leaves the field empty.
    }
  }, []);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;

    if (message.trim().length < 5) {
      setError("Tell us a little more so we can act on it.");
      return;
    }

    const token = readToken();
    if (!token) {
      setError("Please log in so we can reply to you about this.");
      return;
    }

    setSending(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/feedback`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          type,
          message: message.trim(),
          page: page.trim() || null,
        }),
      });

      const result = await response.json().catch(() => ({}));

      if (response.status === 429) {
        throw new Error("You've sent a few already — give it an hour and try again.");
      }

      if (!response.ok) {
        const validation = result?.errors
          ? Object.values(result.errors).flat().join(" ")
          : "";
        throw new Error(validation || result?.message || "Could not send your feedback.");
      }

      setSent(true);
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your feedback.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-16 text-slate-900">
      <header className="sticky top-0 z-20 bg-white shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/"
            aria-label="Back to the Campus Plus feed"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft size={23} strokeWidth={2} />
          </Link>
          <BrandMark size={40} className="shrink-0 rounded-xl" />
          <h1 className="text-xl font-extrabold" style={{ color: navy }}>
            Send feedback
          </h1>
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6 sm:px-6">
        {sent ? (
          <div className="rounded-2xl border border-green-200 bg-white p-8 text-center">
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-green-50 text-green-700">
              <CheckCircle2 size={26} />
            </div>
            <h2 className="font-extrabold" style={{ color: navy }}>Got it — thank you</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This goes straight to the Campus Plus team. We read every one.
            </p>
            <div className="mt-5 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={() => { setSent(false); setError(""); }}
                className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold text-slate-600"
              >
                Send another
              </button>
              <Link
                href="/"
                className="rounded-full px-5 py-2 text-sm font-bold text-[#0B1F3A]"
                style={{ backgroundColor: orange }}
              >
                Back to feed
              </Link>
            </div>
          </div>
        ) : (
          <>
            <p className="mb-5 rounded-2xl border border-slate-200 bg-white p-4 text-sm leading-6 text-slate-600">
              Campus Plus is still being built, and the things you notice are the
              fastest way to make it better. Broken buttons, slow pages, confusing
              wording, missing features — all of it helps.
            </p>

            <form onSubmit={submit} className="space-y-5">
              <div>
                <p className="mb-2 text-sm font-semibold text-slate-700">What kind of feedback?</p>
                <div className="grid gap-2 sm:grid-cols-3">
                  {TYPES.map(({ id, label, Icon }) => {
                    const active = type === id;
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setType(id)}
                        aria-pressed={active}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-3 text-sm font-semibold transition ${
                          active
                            ? "border-transparent text-white"
                            : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                        }`}
                        style={active ? { backgroundColor: navy } : undefined}
                      >
                        <Icon size={17} className="shrink-0" />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label htmlFor="feedback-message" className="mb-1 block text-sm font-semibold text-slate-700">
                  Tell us about it
                </label>
                <textarea
                  id="feedback-message"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  rows={7}
                  maxLength={2000}
                  placeholder={PLACEHOLDERS[type]}
                  className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 sm:text-sm"
                />
                <p className="mt-1 text-right text-xs text-slate-500">{message.length}/2000</p>
              </div>

              <div>
                <label htmlFor="feedback-page" className="mb-1 block text-sm font-semibold text-slate-700">
                  Which page? <span className="font-normal text-slate-500">(optional)</span>
                </label>
                <input
                  id="feedback-page"
                  value={page}
                  onChange={(event) => setPage(event.target.value)}
                  maxLength={255}
                  placeholder="e.g. /market or /chat"
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-orange-400 sm:text-sm"
                />
              </div>

              {error && (
                <p role="alert" className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={sending || message.trim().length < 5}
                className="w-full rounded-full px-6 py-3 text-sm font-bold text-[#0B1F3A] disabled:cursor-not-allowed disabled:opacity-50"
                style={{ backgroundColor: orange }}
              >
                {sending ? "Sending..." : "Send feedback"}
              </button>

              <p className="text-center text-xs leading-5 text-slate-500">
                Your name and the page you were on are sent along with this, so we can
                follow up and reproduce the problem.
              </p>
            </form>
          </>
        )}
      </div>
    </main>
  );
}