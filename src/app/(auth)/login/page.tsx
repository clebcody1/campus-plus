"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import { API_URL } from "@/lib/api";

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#0B1F3A] placeholder:text-slate-400 outline-none focus:border-[#FF7900] focus:ring-2 focus:ring-orange-100";

export default function LoginPage() {
  const router = useRouter();

  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          login: login.trim(),
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const validationErrors = data.errors
          ? Object.values(data.errors).flat().join(" ")
          : data.message;

        throw new Error(validationErrors || "Login failed.");
      }

      localStorage.setItem("campus_life_token", data.token);
      localStorage.setItem("campus_life_user", JSON.stringify(data.user));

      router.push("/");
    } catch (err) {
      console.error("Login request failed:", err);

      setError(
        err instanceof TypeError
          ? "Couldn't reach the server. Please check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Login failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F0F4F9] px-5 py-10">
      <div className="w-full max-w-md rounded-3xl bg-white p-7 shadow-xl sm:p-9">
        {/* The real mark, same as the home page and admin. This page used to
            draw a navy square with a letter C in it, which is the one place
            a new user forms their first impression of the brand. */}
        <Link href="/welcome" className="flex items-center gap-3">
          <BrandMark size={44} className="shrink-0 rounded-xl" />
          <span className="text-xl font-extrabold text-[#0B1F3A]">
            Campus <span className="text-[#FF7900]">Plus</span>
          </span>
        </Link>

        <h1 className="mt-8 text-3xl font-extrabold text-[#0B1F3A]">
          Welcome back
        </h1>

        <p className="mt-2 text-sm leading-6 text-slate-600">
          Log in to connect with your campus community.
        </p>

        <form onSubmit={handleLogin} className="mt-7 space-y-5">
          <div>
            <label
              htmlFor="login"
              className="mb-2 block text-sm font-semibold text-[#0B1F3A]"
            >
              Username or email
            </label>
            <input
              id="login"
              type="text"
              inputMode="email"
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              required
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="username or you@example.com"
              className={inputClass}
            />
          </div>

          <div>
            {/* The link sits beside the label, where people look for it the
                moment the password fails — not buried at the foot of the page. */}
            <div className="mb-2 flex items-baseline justify-between gap-3">
              <label
                htmlFor="password"
                className="block text-sm font-semibold text-[#0B1F3A]"
              >
                Password
              </label>
              <Link
                href="/forgot-password"
                className="text-sm font-semibold text-[#FF7900] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? "text" : "password"}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
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
            {loading ? "Logging in..." : "Log In"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-slate-600">
          Don&apos;t have an account?{" "}
          <Link
            href="/signup"
            className="font-bold text-[#FF7900] hover:underline"
          >
            Sign up
          </Link>
        </p>

        <Link
          href="/welcome"
          className="mt-5 block text-center text-sm font-medium text-slate-500 hover:text-[#0B1F3A]"
        >
          ← Back to welcome page
        </Link>
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