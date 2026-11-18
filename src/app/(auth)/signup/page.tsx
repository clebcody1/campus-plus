"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import BrandMark from "@/components/BrandMark";
import { API_URL } from "@/lib/api";

type UsernameStatus = "idle" | "checking" | "available" | "taken" | "invalid" | "unknown";

type University = { code: string; name: string };

const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

/**
 * Only used if the server can't be reached. The real list comes from
 * /universities, which is the same list the backend validates against, so
 * the two can never drift apart.
 */
const FALLBACK_UNIVERSITIES: University[] = [
  { code: "LAUTECH", name: "Ladoke Akintola University of Technology, Ogbomoso" },
];

/**
 * A fixed list, not a text box.
 *
 * Campus updates are matched to students by exact value, and "300 Level",
 * "300", "Year 3" and "300L" are four different strings. A dropdown is the
 * difference between departmental notices reaching people and matching nobody.
 */
const LEVELS = ["100", "200", "300", "400", "500", "600", "700", "Postgraduate"];

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#0B1F3A] placeholder:text-slate-400 outline-none focus:border-[#FF7900] focus:ring-2 focus:ring-orange-100";

export default function SignupPage() {
  const router = useRouter();

  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>("idle");
  const [usernameMessage, setUsernameMessage] = useState("");
  const [email, setEmail] = useState("");
  const [universities, setUniversities] = useState<University[]>(FALLBACK_UNIVERSITIES);
  const [university, setUniversity] = useState(FALLBACK_UNIVERSITIES[0].code);
  const [department, setDepartment] = useState("");
  const [level, setLevel] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Which schools are open for sign-up. Fetched rather than hardcoded so
  // opening a new campus is one line in the backend config, not a rebuild
  // of the frontend.
  useEffect(() => {
    let cancelled = false;

    fetch(`${API_URL}/universities`, { headers: { Accept: "application/json" } })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.universities) ? data.universities : [];
        if (list.length === 0) return;

        setUniversities(list);
        // Keep whatever is selected if it's still offered, otherwise take
        // the first one so the field is never left on a dead value.
        setUniversity((current) =>
          list.some((item: University) => item.code === current) ? current : list[0].code
        );
      })
      .catch(() => {
        // Keep the fallback. Sign-up must never be blocked by this.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Live "is this username free?" check, a moment after the person stops typing.
  useEffect(() => {
    if (!username) {
      setUsernameStatus("idle");
      setUsernameMessage("");
      return;
    }

    if (!USERNAME_PATTERN.test(username)) {
      setUsernameStatus("invalid");
      setUsernameMessage("Use 3 to 20 letters, numbers or underscores.");
      return;
    }

    let cancelled = false;
    setUsernameStatus("checking");
    setUsernameMessage("Checking...");

    const timeout = window.setTimeout(async () => {
      try {
        const response = await fetch(
          `${API_URL}/username-available?username=${encodeURIComponent(username)}`,
          { headers: { Accept: "application/json" } }
        );
        const data = await response.json();
        if (cancelled) return;

        if (!response.ok) throw new Error();

        setUsernameStatus(data.available ? "available" : "taken");
        setUsernameMessage(
          data.message || (data.available ? "Username is available." : "That username is taken.")
        );
      } catch {
        if (cancelled) return;
        // Don't block sign-up. The server checks again when you submit.
        setUsernameStatus("unknown");
        setUsernameMessage("Couldn't check right now. We'll check again when you sign up.");
      }
    }, 400);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [username]);

  async function handleSignup(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");

    if (!USERNAME_PATTERN.test(username)) {
      setError("Choose a username with 3 to 20 letters, numbers or underscores.");
      return;
    }

    if (usernameStatus === "taken") {
      setError("That username is already taken. Please choose another.");
      return;
    }

    if (!universities.some((item) => item.code === university)) {
      setError("Please select your university.");
      return;
    }

    if (!department.trim()) {
      setError("Enter your department so we can show you the right campus updates.");
      return;
    }

    if (!level) {
      setError("Select your level.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please try again.");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          username,
          email,
          university,
          department: department.trim(),
          level,
          // The older free-text columns are written from the same values, so
          // profile pages and anything else reading them stay correct.
          course: department.trim(),
          year: level === "Postgraduate" ? level : `${level} Level`,
          password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        const validationErrors = data.errors
          ? Object.values(data.errors).flat().join(" ")
          : data.message;

        throw new Error(validationErrors || "Registration failed.");
      }

      localStorage.setItem("campus_life_token", data.token);
      localStorage.setItem("campus_life_user", JSON.stringify(data.user));

      router.push("/");
    } catch (err) {
      console.error("Signup request failed:", err);

      setError(
        err instanceof TypeError
          ? "Couldn't reach the server. Please check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Registration failed. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  const usernameMessageColor =
    usernameStatus === "available"
      ? "text-emerald-700"
      : usernameStatus === "taken" || usernameStatus === "invalid"
        ? "text-red-600"
        : "text-slate-500";

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#F0F4F9] px-5 py-10">
      <div className="w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-xl lg:grid lg:max-w-5xl lg:grid-cols-[0.85fr_1.15fr]">
        {/* Brand panel — desktop only */}
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-[#0B1F3A] p-10 text-white lg:flex">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[32px] border-white/5"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full bg-[#FF7900]/20 blur-3xl"
          />

          {/* The mark sits in a white tile here, the way the old placeholder
              did. This panel is navy, and a logo with dark in it would sink
              straight into the background. */}
          <Link href="/welcome" className="relative flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white">
              <BrandMark size={38} className="rounded-lg" />
            </span>
            <span className="text-xl font-extrabold">
              Campus <span className="text-[#FF7900]">Plus</span>
            </span>
          </Link>

          <div className="relative">
            <h2 className="text-3xl font-extrabold leading-tight">
              Your campus,
              <br />
              all in one place.
            </h2>
            <ul className="mt-7 space-y-4 text-sm leading-6 text-slate-200">
              {[
                "Updates from your own department",
                "Find events happening on campus",
                "Buy and sell in the student marketplace",
                "Message classmates directly",
              ].map((item) => (
                <li key={item} className="flex items-start gap-3">
                  <span className="mt-1.5 flex h-1.5 w-1.5 shrink-0 rounded-full bg-[#FF7900]" />
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <p className="relative text-xs text-slate-400">
            Made for Nigerian university students.
          </p>
        </aside>

        {/* Form panel */}
        <div className="p-7 sm:p-9 lg:p-10">
          <Link href="/welcome" className="flex items-center gap-3 lg:hidden">
            <BrandMark size={44} className="shrink-0 rounded-xl" />
            <span className="text-xl font-extrabold text-[#0B1F3A]">
              Campus <span className="text-[#FF7900]">Plus</span>
            </span>
          </Link>

          <h1 className="mt-8 text-3xl font-extrabold text-[#0B1F3A] lg:mt-0">
            Join Campus Plus
          </h1>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Connect with students, discover events, and explore your campus community.
          </p>

          <form onSubmit={handleSignup} className="mt-7 space-y-5">
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="name" className="mb-2 block text-sm font-semibold text-[#0B1F3A]">
                  Full name
                </label>
                <input
                  id="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your full name"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="username" className="mb-2 block text-sm font-semibold text-[#0B1F3A]">
                  Username
                </label>
                <div className="relative">
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
                  >
                    @
                  </span>
                  <input
                    id="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    required
                    minLength={3}
                    maxLength={20}
                    value={username}
                    onChange={(e) =>
                      setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20))
                    }
                    aria-describedby="username-help"
                    placeholder="your_username"
                    className={`${inputClass} pl-9`}
                  />
                </div>
                <p id="username-help" aria-live="polite" className={`mt-2 min-h-5 text-xs ${usernameMessageColor}`}>
                  {usernameMessage || "3 to 20 characters: letters, numbers and underscores."}
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="email" className="mb-2 block text-sm font-semibold text-[#0B1F3A]">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>

              <div>
                <label htmlFor="university" className="mb-2 block text-sm font-semibold text-[#0B1F3A]">
                  University
                </label>
                <select
                  id="university"
                  required
                  value={university}
                  onChange={(e) => setUniversity(e.target.value)}
                  className={inputClass}
                >
                  {universities.map((item) => (
                    <option key={item.code} value={item.code}>
                      {item.code} ({item.name})
                    </option>
                  ))}
                </select>
                {universities.length === 1 && (
                  <p className="mt-2 text-xs text-slate-500">
                    More campuses coming soon.
                  </p>
                )}
              </div>
            </div>

            {/* Department and level decide which campus updates reach this
                student, so they are asked for here rather than left to a
                profile edit almost nobody makes. */}
            <div className="grid gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="department" className="mb-2 block text-sm font-semibold text-[#0B1F3A]">
                  Department
                </label>
                <input
                  id="department"
                  type="text"
                  required
                  maxLength={120}
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder="e.g. Mechanical Engineering"
                  aria-describedby="department-help"
                  className={inputClass}
                />
                <p id="department-help" className="mt-2 text-xs text-slate-500">
                  Spell it the way your department does.
                </p>
              </div>

              <div>
                <label htmlFor="level" className="mb-2 block text-sm font-semibold text-[#0B1F3A]">
                  Level
                </label>
                <select
                  id="level"
                  required
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className={inputClass}
                >
                  <option value="" disabled>Select your level</option>
                  {LEVELS.map((item) => (
                    <option key={item} value={item}>
                      {item === "Postgraduate" ? "Postgraduate" : `${item} Level`}
                    </option>
                  ))}
                </select>
                <p className="mt-2 text-xs text-slate-500">
                  You can change this from your profile each session.
                </p>
              </div>
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <PasswordField
                id="password"
                label="Password"
                value={password}
                onChange={setPassword}
                visible={showPassword}
                onToggle={() => setShowPassword((v) => !v)}
                placeholder="At least 8 characters"
              />

              <PasswordField
                id="confirmPassword"
                label="Confirm password"
                value={confirmPassword}
                onChange={setConfirmPassword}
                visible={showConfirmPassword}
                onToggle={() => setShowConfirmPassword((v) => !v)}
                placeholder="Re-enter your password"
              />
            </div>

            {error && (
              <p role="alert" className="text-sm text-red-600">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || usernameStatus === "taken" || usernameStatus === "invalid"}
              className="w-full rounded-xl bg-[#FF7900] px-5 py-3.5 font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? "Creating account..." : "Create Account"}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-600">
            Already have an account?{" "}
            <Link href="/login" className="font-bold text-[#FF7900] hover:underline">
              Log in
            </Link>
          </p>

          <p className="mt-5 text-center text-xs leading-5 text-slate-400">
            Your account details will be saved securely.
          </p>
        </div>
      </div>
    </main>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggle: () => void;
  placeholder?: string;
};

function PasswordField({
  id,
  label,
  value,
  onChange,
  visible,
  onToggle,
  placeholder,
}: PasswordFieldProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-2 block text-sm font-semibold text-[#0B1F3A]">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          minLength={8}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={`${inputClass} pr-12`}
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={visible}
          className="absolute inset-y-0 right-0 flex w-12 items-center justify-center rounded-r-xl text-slate-400 transition hover:text-[#0B1F3A] focus:outline-none focus-visible:text-[#FF7900]"
        >
          {visible ? <EyeIcon /> : <EyeOffIcon />}
        </button>
      </div>
    </div>
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