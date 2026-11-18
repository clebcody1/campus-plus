"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import VerifiedBadge from "@/components/VerifiedBadge";
import BottomNav from "@/components/BottomNav";
import { API_URL } from "@/lib/api";

type Step = "email" | "code" | "done";

async function postJson(path: string, body: Record<string, string>) {
  const token = window.localStorage.getItem("campus_life_token");
  if (!token) throw new Error("Please log in to verify your account.");

  const response = await fetch(`${API_URL}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const validation = result?.errors ? Object.values(result.errors).flat().join(" ") : "";
    throw new Error(validation || result?.message || "Something went wrong. Please try again.");
  }
  return result;
}

export default function VerifyPage() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // If the cached user is already verified (or an admin), skip straight to the done screen.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem("campus_life_user");
      const user = raw ? JSON.parse(raw) : null;
      const isAdmin =
        user?.is_admin === true || user?.isAdmin === true || String(user?.role ?? "").toLowerCase() === "admin";
      if (user?.is_verified || isAdmin) setStep("done");
    } catch {
      // Ignore a corrupt cached user.
    }
  }, []);

  async function sendCode(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await postJson("/verification/send", { email: email.trim() });
      setNotice(result.message ?? "We sent you a code.");
      setCode("");
      setStep("code");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const result = await postJson("/verification/confirm", { code: code.trim() });

      // Keep the cached profile in sync so the tick shows straight away.
      try {
        const raw = window.localStorage.getItem("campus_life_user");
        const cached = raw ? JSON.parse(raw) : {};
        window.localStorage.setItem(
          "campus_life_user",
          JSON.stringify({ ...cached, ...(result.user ?? {}), is_verified: true })
        );
      } catch {
        // Not critical: the profile page refreshes from the server.
      }

      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not verify the code.");
    } finally {
      setBusy(false);
    }
  }

  const inputClass =
    "w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none transition focus:border-[#FF7900] focus:ring-2 focus:ring-[#FF7900]/25";
  const primaryBtn =
    "w-full rounded-xl bg-[#FF7900] px-5 py-3 text-sm font-bold text-[#0B1F3A] transition hover:bg-[#FF8F26] disabled:opacity-60";

  return (
    <main className="min-h-screen bg-[#F0F4F9] pb-28 text-[#0B1F3A]">
      <header className="bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4 sm:px-6">
          <Link href="/profile" className="text-sm font-semibold text-gray-600 hover:text-[#0B1F3A]">
            ← Back to profile
          </Link>
          <span className="text-lg font-extrabold tracking-tight">
            Campus <span className="text-[#FF7900]">Plus</span>
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-md px-4 py-8 sm:py-12">
        <div className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
          {step === "done" ? (
            <div className="text-center" role="status">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF3E8]">
                <VerifiedBadge className="h-10 w-10" />
              </div>
              <h1 className="mt-4 text-2xl font-extrabold">You&apos;re verified</h1>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                Your verified tick now shows beside your name across Campus Plus.
              </p>
              <Link
                href="/profile"
                className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#0B1F3A] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#15345b]"
              >
                Back to my profile
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <VerifiedBadge className="h-8 w-8" />
                <h1 className="text-2xl font-extrabold">Get verified</h1>
              </div>
              <p className="mt-2 text-sm leading-6 text-gray-600">
                {step === "email"
                  ? "Enter your school email address. We will send you a 6-digit code right away."
                  : "Enter the 6-digit code we sent to your school email. It expires in 10 minutes."}
              </p>

              {error && (
                <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {error}
                </p>
              )}
              {notice && !error && (
                <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">
                  {notice}
                </p>
              )}

              {step === "email" ? (
                <form onSubmit={sendCode} className="mt-5 space-y-4">
                  <label className="block text-sm font-semibold">
                    School email
                    <input
                      required
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="name@lautech.edu.ng"
                      className={`mt-2 font-normal ${inputClass}`}
                    />
                  </label>
                  <button type="submit" disabled={busy || !email.trim()} className={primaryBtn}>
                    {busy ? "Sending..." : "Send code"}
                  </button>
                </form>
              ) : (
                <form onSubmit={confirmCode} className="mt-5 space-y-4">
                  <label className="block text-sm font-semibold">
                    Verification code
                    <input
                      required
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      maxLength={6}
                      value={code}
                      onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                      placeholder="123456"
                      className={`mt-2 text-center font-bold tracking-[0.4em] ${inputClass}`}
                    />
                  </label>
                  <button type="submit" disabled={busy || code.length !== 6} className={primaryBtn}>
                    {busy ? "Checking..." : "Verify"}
                  </button>
                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => {
                        setStep("email");
                        setError("");
                        setNotice("");
                      }}
                      className="font-semibold text-gray-600 hover:text-[#0B1F3A]"
                    >
                      Change email
                    </button>
                    <button
                      type="button"
                      onClick={() => void sendCode()}
                      disabled={busy}
                      className="font-semibold text-[#B45309] hover:underline disabled:opacity-60"
                    >
                      Resend code
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>

      <BottomNav />
    </main>
  );
}