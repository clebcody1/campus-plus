"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { API_URL } from "@/lib/api";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#0B1F3A] placeholder:text-slate-400 outline-none focus:border-[#FF7900] focus:ring-2 focus:ring-orange-100";

/** Seconds before "Send again" becomes available. */
const RESEND_SECONDS = 45;

export default function ForgotPasswordPage() {
  const router = useRouter();

  const [step, setStep] = useState<"email" | "code">("email");

  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  const codeRef = useRef<HTMLInputElement>(null);

  // Count the resend timer down to zero.
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((n) => n - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // Put the cursor in the code box the moment step two appears.
  useEffect(() => {
    if (step === "code") codeRef.current?.focus();
  }, [step]);

  function readError(data: Record<string, unknown>, fallback: string) {
    const errors = data.errors as Record<string, string[]> | undefined;
    if (errors) return Object.values(errors).flat().join(" ");
    return (data.message as string) || fallback;
  }

  async function requestCode(e?: React.FormEvent<HTMLFormElement>) {
    e?.preventDefault();
    setError("");
    setNotice("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/forgot-password`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(readError(data, "Could not send the code. Please try again."));
      }

      setNotice(data.message || "Check your email for the code.");
      setStep("code");
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Couldn't reach the server. Please check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  async function submitReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setNotice("");

    if (password !== confirmPassword) {
      setError("The two passwords do not match.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/reset-password`, {
        method: "POST",
        headers: { Accept: "application/json", "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim().toLowerCase(),
          code: code.trim(),
          password,
          password_confirmation: confirmPassword,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(readError(data, "Could not reset your password."));
      }

      /*
       | The server deleted every token for this account, so anything still
       | cached here is dead. Clear it before sending them to the login page,
       | or the app will try to use a token the server no longer honours.
       */
      try {
        localStorage.removeItem("campus_life_token");
        localStorage.removeItem("campus_life_user");
      } catch {
        // Private browsing can refuse storage. Nothing to clean up then.
      }

      setNotice(data.message || "Your password has been changed.");
      setTimeout(() => router.push("/login"), 1400);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Couldn't reach the server. Please check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F0F4F9] px-5 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl sm:p-9">
        <Link href="/welcome" className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B1F3A] text-xl font-bold text-white">
            C
          </span>
          <span className="text-xl font-extrabold text-[#0B1F3A]">
            Campus <span className="text-[#FF7900]">Plus</span>
          </span>
        </Link>

        <h1 className="mt-8 text-3xl font-extrabold text-[#0B1F3A]">
          {step === "email" ? "Forgot password" : "Enter your code"}
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          {step === "email"
            ? "Enter the email address you signed up with and we'll send you a 6-digit code."
            : `We sent a 6-digit code to ${email}. It expires in 15 minutes.`}
        </p>

        {step === "email" ? (
          <form onSubmit={requestCode} className="mt-7 space-y-5">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#0B1F3A]">
                Email address
              </label>
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#FF7900] px-5 py-3.5 font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Sending..." : "Send code"}
            </button>
          </form>
        ) : (
          <form onSubmit={submitReset} className="mt-7 space-y-5">
            <div>
              <label htmlFor="code" className="mb-2 block text-sm font-semibold text-[#0B1F3A]">
                6-digit code
              </label>
              <input
                ref={codeRef}
                id="code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                required
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
                placeholder="000000"
                className={`${inputClass} text-center text-2xl font-bold tracking-[0.5em]`}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm font-semibold text-[#0B1F3A]">
                New password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className={`${inputClass} pr-12`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-400 transition hover:text-[#0B1F3A] focus:outline-none focus-visible:text-[#FF7900]"
                >
                  {showPassword ? <EyeIcon /> : <EyeOffIcon />}
                </button>
              </div>
            </div>

            <div>
              <label
                htmlFor="confirmPassword"
                className="mb-2 block text-sm font-semibold text-[#0B1F3A]"
              >
                Confirm new password
              </label>
              <input
                id="confirmPassword"
                type={showPassword ? "text" : "password"}
                autoComplete="new-password"
                required
                minLength={8}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Type it again"
                className={inputClass}
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            {notice && !error && (
              <p role="status" className="text-sm font-medium text-green-700">
                {notice}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl bg-[#FF7900] px-5 py-3.5 font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Changing password..." : "Change password"}
            </button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                  setError("");
                  setNotice("");
                }}
                className="font-medium text-slate-500 hover:text-[#0B1F3A]"
              >
                ← Wrong email?
              </button>

              <button
                type="button"
                onClick={() => requestCode()}
                disabled={cooldown > 0 || loading}
                className="font-bold text-[#FF7900] hover:underline disabled:cursor-not-allowed disabled:text-slate-400 disabled:no-underline"
              >
                {cooldown > 0 ? `Send again in ${cooldown}s` : "Send again"}
              </button>
            </div>
          </form>
        )}

        <p className="mt-6 text-center text-sm text-slate-600">
          Remembered it?{" "}
          <Link href="/login" className="font-bold text-[#FF7900] hover:underline">
            Log in
          </Link>
        </p>
      </div>
    </main>
  );
}

function EyeIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.6 10.6a3 3 0 0 0 4.2 4.2" />
      <path d="M9.4 5.2A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a17.8 17.8 0 0 1-3.2 4.2M6.2 6.2A17.6 17.6 0 0 0 2 12s3.5 7 10 7a9.7 9.7 0 0 0 4.3-1" />
      <path d="m2 2 20 20" />
    </svg>
  );
}