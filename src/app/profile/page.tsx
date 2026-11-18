"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import BottomNav from "@/components/BottomNav";
import BrandMark from "@/components/BrandMark";
import {
  Heart, MessageCircle, GraduationCap, NotebookPen, SquarePen, MessageSquare,
  Home as HomeIcon, CalendarDays, ShoppingBag, UserRound,
} from "lucide-react";
import VerifiedBadge from "@/components/VerifiedBadge";
import PostImages from "@/components/PostImages";
import { API_URL, storageUrl } from "@/lib/api";

type Student = {
  id?: number;
  name: string;
  username?: string | null;
  email: string;
  university?: string;
  bio?: string;
  course?: string;
  year?: string;
  faculty?: string;
  department?: string;
  level?: string;
  avatar?: string;
  role?: string;
  is_admin?: boolean;
  isAdmin?: boolean;
  is_verified?: boolean;
  avatar_path?: string | null;
};

type ProfileStats = {
  followers_count: number;
  following_count: number;
  posts_count: number;
};

type UserPost = {
  id: number;
  content: string;
  image_path: string | null;
  image_paths?: string[] | null;
  created_at: string;
  likes_count?: number;
  comments_count?: number;
};

// Profile photos are stored by Laravel; the API returns only the stored path.
const avatarUrl = (path?: string | null) => storageUrl(path) ?? "";

const navy = "#0B1F3A";
const orange = "#FF7900";

/**
 * A fixed list, not a text box.
 *
 * Campus updates are matched to students by exact value, and "300 Level",
 * "300", "Year 3" and "300L" are four different strings. A dropdown is the
 * difference between the filter working and quietly matching nobody.
 */
const LEVELS = ["100", "200", "300", "400", "500", "600", "700", "Postgraduate"] as const;

/** Pulls "300" out of whatever an older account typed into the year field. */
function guessLevel(year?: string) {
  if (!year) return "";
  if (/post|pg|msc|phd/i.test(year)) return "Postgraduate";
  const digits = year.match(/\d{3}/)?.[0];
  if (digits && (LEVELS as readonly string[]).includes(digits)) return digits;
  // "Year 3" style
  const short = year.match(/\b([1-7])\b/)?.[1];
  return short ? `${short}00` : "";
}

const profileNavigationItems = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/events" },
  { label: "Chat", href: "/chat" },
  { label: "Market", href: "/market" },
  { label: "Profile", href: "/profile" },
] as const;

// Same lucide icons the home page uses, so both sidebars look identical.
const navIcons = {
  Home: HomeIcon,
  Events: CalendarDays,
  Chat: MessageCircle,
  Market: ShoppingBag,
  Profile: UserRound,
} as const;

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";
const primaryBtn = `rounded-xl bg-[#FF7900] px-5 py-3 text-sm font-bold text-[#0B1F3A] transition hover:bg-[#FF8F26] disabled:opacity-60 ${focus}`;
const ghostBtn = `rounded-xl border border-gray-200 bg-white px-5 py-3 text-sm font-semibold transition hover:bg-gray-50 ${focus}`;

const fieldCls = "block w-full min-w-0 rounded-xl border border-gray-300 bg-white px-4 py-3 text-base outline-none transition focus:border-[#FF7900] focus:ring-2 focus:ring-[#FF7900]/25 sm:text-sm";

function Field({
  label, value, onChange, placeholder, type = "text", multiline = false, required = false, hint,
}: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  type?: string; multiline?: boolean; required?: boolean; hint?: string;
}) {
  // text-base (16px) on phones stops the browser zooming in when you tap a field.
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">{label}</span>
      {multiline ? (
        <textarea rows={4} maxLength={300} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={`${fieldCls} resize-y`} />
      ) : (
        <input required={required} type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className={fieldCls} />
      )}
      {multiline && <span className="mt-1 block text-right text-xs text-gray-500">{value.length}/300</span>}
      {hint && <span className="mt-2 block text-xs text-gray-500">{hint}</span>}
    </label>
  );
}

function LevelField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold">Level</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={fieldCls}>
        <option value="">Not set</option>
        {LEVELS.map((item) => (
          <option key={item} value={item}>
            {item === "Postgraduate" ? "Postgraduate" : `${item} Level`}
          </option>
        ))}
      </select>
      <span className="mt-2 block text-xs text-gray-500">
        Update this when you move up a level so you keep getting the right campus updates.
      </span>
    </label>
  );
}

// Bio box: grows as you type (up to a limit, then scrolls inside the box), never
// stretches the page, and shows a live character counter.
function BioField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const max = 300;
  const ref = useRef<HTMLTextAreaElement>(null);
  const remaining = max - value.length;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 220)}px`;
  }, [value]);

  return (
    <div>
      <label htmlFor="profile-bio" className="mb-2 flex items-baseline justify-between gap-3 text-sm font-semibold">
        <span>Bio</span>
        <span className="text-xs font-normal text-gray-500">Optional</span>
      </label>

      <div className="overflow-hidden rounded-xl border border-gray-300 bg-white transition focus-within:border-[#FF7900] focus-within:ring-2 focus-within:ring-[#FF7900]/25">
        <textarea
          id="profile-bio"
          ref={ref}
          rows={3}
          maxLength={max}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Tell other students about yourself: your course, interests, what you're looking for..."
          className="block max-h-[220px] min-h-[96px] w-full min-w-0 resize-none overflow-y-auto break-words bg-transparent px-4 py-3 text-base leading-6 outline-none sm:text-sm"
        />
        <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 px-4 py-2 text-xs">
          <span className="text-gray-500">Shown on your profile</span>
          <span className={remaining <= 30 ? "font-semibold text-[#B45309]" : "text-gray-500"}>
            {value.length}/{max}
          </span>
        </div>
      </div>
    </div>
  );
}

function timeAgo(dateString: string) {
  const ms = new Date(dateString).getTime();
  if (Number.isNaN(ms)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return new Date(dateString).toLocaleDateString();
}

// usePathname lives here so it can sit inside <Suspense> (Next.js requires that).
function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-2" aria-label="Campus sections">
      {profileNavigationItems.map(({ label, href }) => {
        const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        const isChat = label === "Chat";
        const desktopLabel = label === "Market" ? "Marketplace" : label === "Profile" ? "My profile" : label;
        const NavIcon = navIcons[label];

        if (isChat) {
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`my-3 flex items-center gap-3 rounded-full py-2 pl-2 pr-5 text-sm font-bold shadow-md shadow-[#FF7900]/30 transition hover:-translate-y-0.5 active:scale-95 ${
                active ? "text-white" : "text-[#0B1F3A]"
              }`}
              style={{ backgroundColor: active ? navy : orange }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: active ? orange : navy }}
              >
                <NavIcon size={20} strokeWidth={1.8} aria-hidden="true" />
              </span>
              {desktopLabel}
            </Link>
          );
        }

        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active ? "text-white" : "text-slate-600 hover:bg-slate-50"}`}
            style={active ? { backgroundColor: navy } : undefined}
          >
            <NavIcon size={20} strokeWidth={1.8} aria-hidden="true" />
            {desktopLabel}
          </Link>
        );
      })}
    </nav>
  );
}

const emptyForm = {
  name: "", university: "", bio: "", faculty: "", department: "", level: "", avatar: "",
};

/**
 * Fills the editor. Accounts created before faculty/department/level existed
 * fall back to whatever they typed into the old course and year fields, so
 * they only have to confirm rather than start again.
 */
const toForm = (u: Student) => ({
  name: u.name || "",
  university: u.university || "",
  bio: u.bio || "",
  faculty: u.faculty || "",
  department: u.department || u.course || "",
  level: u.level || guessLevel(u.year),
  avatar: u.avatar || "",
});

export default function ProfilePage() {
  const router = useRouter();
  const formRef = useRef<HTMLElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"posts" | "about">("posts");
  const [avatarFailed, setAvatarFailed] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [stats, setStats] = useState<ProfileStats | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const token = localStorage.getItem("campus_life_token");
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }

      let cached: Student | null = null;
      try {
        const raw = localStorage.getItem("campus_life_user");
        const parsed = raw ? (JSON.parse(raw) as Student) : null;
        if (parsed && typeof parsed.name === "string" && typeof parsed.email === "string") cached = parsed;
      } catch {
        localStorage.removeItem("campus_life_user");
      }

      if (cached && !cancelled) {
        setStudent(cached);
        setForm(toForm(cached));
        setLoading(false); // show cached profile immediately, refresh in background
      }

      try {
        const res = await fetch(`${API_URL}/user`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
          cache: "no-store",
        });
        if (res.status === 401) {
          localStorage.removeItem("campus_life_token");
          localStorage.removeItem("campus_life_user");
          if (!cancelled) setStudent(null);
          return;
        }
        if (!res.ok) throw new Error(`Profile request failed (${res.status})`);

        const data = await res.json();
        const api = (data.user ?? data) as Student;
        const merged: Student = {
          ...cached,
          ...api,
          // The server is the source of truth. An older on-device copy is only used
          // until the first save sends it to the server.
          bio: api.bio ?? cached?.bio ?? "",
          course: api.course ?? cached?.course ?? "",
          year: api.year ?? cached?.year ?? "",
          faculty: api.faculty ?? cached?.faculty ?? "",
          department: api.department ?? cached?.department ?? "",
          level: api.level ?? cached?.level ?? "",
          avatar: api.avatar_path
            ? avatarUrl(api.avatar_path)
            : cached?.avatar?.startsWith("data:")
              ? cached.avatar
              : "",
          role: api.role || cached?.role,
          is_admin: api.is_admin ?? cached?.is_admin,
          isAdmin: api.isAdmin ?? cached?.isAdmin,
        };
        localStorage.setItem("campus_life_user", JSON.stringify(merged));
        if (!cancelled) {
          setStudent(merged);
          setForm(toForm(merged));
        }
      } catch (error) {
        console.error("Could not load Campus Plus profile:", error);
        if (!cached && !cancelled) setMessage("We couldn't load your profile. Check your connection and try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadProfile();
    return () => { cancelled = true; };
  }, []);

  // Real post, follower and following counts, and your own posts.
  // This uses the same /users/{id} endpoints as other students' profiles.
  const myId = student?.id;
  useEffect(() => {
    if (!myId) return;
    const token = localStorage.getItem("campus_life_token");
    if (!token) return;

    let cancelled = false;
    setPostsLoading(true);

    const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };

    (async () => {
      const [profileResult, postsResult] = await Promise.allSettled([
        fetch(`${API_URL}/users/${myId}`, { headers, cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
        fetch(`${API_URL}/users/${myId}/posts`, { headers, cache: "no-store" }).then((r) => (r.ok ? r.json() : Promise.reject(r.status))),
      ]);
      if (cancelled) return;

      if (profileResult.status === "fulfilled") {
        const data = profileResult.value;
        setStats({
          followers_count: Number(data.followers_count ?? 0),
          following_count: Number(data.following_count ?? 0),
          posts_count: Number(data.posts_count ?? 0),
        });
      }

      if (postsResult.status === "fulfilled") {
        const data = postsResult.value;
        setPosts(Array.isArray(data) ? data : data.data ?? []);
      }

      setPostsLoading(false);
    })();

    return () => { cancelled = true; };
  }, [myId]);

  // Auto-dismiss confirmation messages
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(t);
  }, [message]);

  // Bring the form into view when editing starts
  useEffect(() => {
    if (editing) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [editing]);

  const set = (field: keyof typeof form) => (value: string) => setForm((f) => ({ ...f, [field]: value }));

  function openEditor() {
    if (student) setForm(toForm(student));
    setAvatarFile(null);
    setRemoveAvatar(false);
    setMessage("");
    setEditing(true);
  }

  function closeEditor() {
    if (student) setForm(toForm(student));
    setAvatarFile(null);
    setRemoveAvatar(false);
    setEditing(false);
  }

  function chooseAvatar(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setMessage("Choose an image file.");
      return;
    }
    // The server shrinks and re-encodes the photo, so a full-size phone
    // picture is fine. This only stops absurdly large files.
    if (file.size > 8 * 1024 * 1024) {
      setMessage("Choose an image smaller than 8 MB.");
      if (avatarInputRef.current) avatarInputRef.current.value = "";
      return;
    }
    setAvatarFile(file);
    setRemoveAvatar(false);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setForm((current) => ({ ...current, avatar: reader.result as string }));
        setAvatarFailed(false);
      }
    };
    reader.onerror = () => setMessage("We couldn't read that photo. Please try another one.");
    reader.readAsDataURL(file);
  }

  async function saveProfile(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!student || saving) return;

    const name = form.name.trim();
    if (!name) return setMessage("Enter your name to save.");

    const token = localStorage.getItem("campus_life_token");
    if (!token) return setMessage("Please log in again to save your profile.");

    const department = form.department.trim();
    const level = form.level.trim();

    // Multipart form data so the photo uploads in the same request.
    const body = new FormData();
    body.append("name", name);
    body.append("university", form.university.trim());
    body.append("faculty", form.faculty.trim());
    body.append("department", department);
    body.append("level", level);
    body.append("bio", form.bio.trim());

    // The old free-text columns are kept in step with the structured ones, so
    // anything still reading course/year — other students' profile pages, the
    // admin dashboard — keeps showing the right thing.
    body.append("course", department);
    body.append("year", level ? (level === "Postgraduate" ? level : `${level} Level`) : "");

    if (avatarFile) body.append("avatar", avatarFile);
    else if (removeAvatar) body.append("remove_avatar", "1");

    setSaving(true);
    try {
      const res = await fetch(`${API_URL}/user/profile`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        body,
      });
      const result = await res.json().catch(() => ({}));

      if (!res.ok) {
        if (res.status === 401) throw new Error("Your session has expired. Please log in again.");
        const validation = result?.errors ? Object.values(result.errors).flat().join(" ") : "";
        throw new Error(validation || result?.message || "Could not save your profile.");
      }

      const saved = (result.user ?? result) as Student;
      const updated: Student = {
        ...student,
        ...saved,
        university: saved.university ?? "",
        bio: saved.bio ?? "",
        course: saved.course ?? "",
        year: saved.year ?? "",
        faculty: saved.faculty ?? "",
        department: saved.department ?? "",
        level: saved.level ?? "",
        avatar: avatarUrl(saved.avatar_path),
        role: saved.role ?? student.role,
      };

      localStorage.setItem("campus_life_user", JSON.stringify(updated));
      setStudent(updated);
      setForm(toForm(updated));
      setAvatarFile(null);
      setRemoveAvatar(false);
      setAvatarFailed(false);
      setEditing(false);
      setMessage("Profile saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setSaving(false);
    }
  }

  async function logout() {
    const token = localStorage.getItem("campus_life_token");
    try {
      if (token) {
        await fetch(`${API_URL}/logout`, {
          method: "POST",
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        });
      }
    } catch (error) {
      console.error("Logout request failed:", error);
    } finally {
      localStorage.removeItem("campus_life_token");
      localStorage.removeItem("campus_life_user");
      router.replace("/login");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F0F4F9] px-5">
        <div className="text-center" role="status">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#FF7900] border-t-transparent" />
          <p className="text-sm font-medium text-[#0B1F3A]">Loading your profile…</p>
        </div>
      </main>
    );
  }

  if (!student) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F0F4F9] px-5 pb-24 text-[#0B1F3A]">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#FFF3E8]">
            <GraduationCap size={32} className="text-[#B45309]" />
          </div>
          <h1 className="text-2xl font-bold">Log in to see your profile</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">Your details, posts and campus activity live here.</p>
          {message && <p role="alert" className="mt-3 text-sm text-red-700">{message}</p>}
          <Link href="/login" className={`mt-6 inline-flex w-full items-center justify-center ${primaryBtn}`}>Log in</Link>
          <Link href="/" className={`mt-3 inline-flex rounded-lg text-sm font-medium ${focus}`}>Back to home</Link>
        </div>
        <BottomNav />
      </main>
    );
  }

  const isAdmin =
    student.is_admin === true ||
    student.isAdmin === true ||
    student.role?.toLowerCase() === "admin";

  const showVerified = Boolean(student.is_verified) || isAdmin;

  const initials = (student.name || "S").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  const departmentText = student.department || student.course || "";
  const levelText = student.level
    ? (student.level === "Postgraduate" ? "Postgraduate" : `${student.level} Level`)
    : (student.year || "");

  const details: [string, string | undefined][] = [
    ["Full name", student.name],
    ["Username", student.username ? `@${student.username}` : undefined],
    ["Email", student.email],
    ["University", student.university],
    ["Faculty", student.faculty],
    ["Department", departmentText],
    ["Level", levelText],
  ];

  // Nudge shown when we can't match this student to departmental updates yet.
  const missingAcademics = !student.department && !student.faculty && !student.level;

  return (
    <main className="min-h-screen overflow-x-clip bg-[#F0F4F9] pb-28 text-[#0B1F3A] lg:pb-12">
      <header className="sticky top-0 z-30 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={40} className="shrink-0 rounded-xl" />
            <span className="text-xl font-extrabold tracking-tight" style={{ color: "#0B1F3A" }}>
              Campus <span style={{ color: "#FF7900" }}>Plus</span>
            </span>
          </Link>
        </div>
      </header>

      {message && (
        <div className="pointer-events-none fixed inset-x-0 top-20 z-50 flex justify-center px-4">
          <p role="status" className="pointer-events-auto rounded-xl bg-[#0B1F3A] px-5 py-3 text-sm font-semibold text-white shadow-lg">{message}</p>
        </div>
      )}

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 sm:py-8 lg:grid-cols-[210px_minmax(0,1fr)]">
        {/* Left sidebar (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Your campus</p>
            <div className="mb-5 rounded-xl p-3" style={{ backgroundColor: "#F0F4F9" }}>
              <p className="flex items-center gap-2 font-bold" style={{ color: navy }}>
                <GraduationCap size={18} /> Select university
              </p>
              <p className="mt-1 text-xs text-slate-500">Choose your campus</p>
            </div>

            <Suspense fallback={<div className="h-64" />}>
              <SidebarNav />
            </Suspense>

            <div className="mt-6 rounded-xl p-4" style={{ backgroundColor: "#FFF3E8" }}>
              <p className="font-bold" style={{ color: navy }}>Your campus, your people.</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">Discover what&apos;s happening across Nigerian universities.</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
          <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)] lg:items-start">
            {/* Identity card */}
            <section className="min-w-0 overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm lg:sticky lg:top-24">
              <div className="h-24 bg-[#0B1F3A]">
                <div className="h-full w-full bg-[radial-gradient(circle_at_85%_0%,rgba(255,121,0,0.35),transparent_55%)]" />
              </div>
              <div className="px-6 pb-6">
                <div className="-mt-12 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-[#FFF3E8] text-3xl font-extrabold shadow-sm">
                  {student.avatar && !avatarFailed ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={student.avatar} alt={`${student.name}'s profile photo`} onError={() => setAvatarFailed(true)} className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>

                <h1 className="mt-4 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
                  <span className="min-w-0 break-words">{student.name}</span>
                  {showVerified && <VerifiedBadge admin={isAdmin} />}
                </h1>
                {student.username && (
                  <p className="mt-1 text-sm font-semibold text-[#B45309]">@{student.username}</p>
                )}
                <p className="mt-1 break-all text-sm text-gray-600">{student.email}</p>

                {(student.university || departmentText || levelText) && (
                  <ul className="mt-4 flex flex-wrap gap-2">
                    {[student.university, departmentText, levelText].filter(Boolean).map((t) => (
                      <li key={t} className="rounded-full bg-[#F0F4F9] px-3 py-1 text-xs font-semibold text-[#0B1F3A]">{t}</li>
                    ))}
                  </ul>
                )}

                <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">
                  {student.bio || "Add a bio so other students know who you are."}
                </p>

                {/* Followers and Following open the connections page. */}
                <dl className="mt-6 grid grid-cols-3 divide-x divide-gray-200 rounded-2xl border border-gray-200 py-3 text-center">
                  <div className="px-2">
                    <dd className="text-xl font-extrabold">{stats?.posts_count ?? posts.length}</dd>
                    <dt className="text-xs text-gray-600">Posts</dt>
                  </div>

                  <Link
                    href={`/users/${student.id}/connections?tab=followers`}
                    className={`px-2 transition hover:bg-slate-50 ${focus}`}
                  >
                    <dd className="text-xl font-extrabold">{stats?.followers_count ?? 0}</dd>
                    <dt className="text-xs text-gray-600">Followers</dt>
                  </Link>

                  <Link
                    href={`/users/${student.id}/connections?tab=following`}
                    className={`px-2 transition hover:bg-slate-50 ${focus}`}
                  >
                    <dd className="text-xl font-extrabold">{stats?.following_count ?? 0}</dd>
                    <dt className="text-xs text-gray-600">Following</dt>
                  </Link>
                </dl>

                {!editing && (
                  <button onClick={openEditor} className={`mt-5 flex w-full items-center justify-center gap-2 ${primaryBtn}`}>
                    <SquarePen size={16} strokeWidth={1.8} /> Edit profile
                  </button>
                )}
                {showVerified ? (
                  <p className={`mt-3 flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold ${isAdmin ? "bg-[#FFF3E8] text-[#B45309]" : "bg-sky-50 text-sky-800"}`}>
                    <VerifiedBadge className="h-4 w-4" admin={isAdmin} /> {isAdmin ? "Verified admin" : "Verified student"}
                  </p>
                ) : (
                  <Link href="/verify" className={`mt-3 flex w-full items-center justify-center rounded-xl border border-sky-300 px-4 py-3 text-sm font-bold text-sky-800 transition hover:bg-sky-50 ${focus}`}>
                    Get verified
                  </Link>
                )}
                {isAdmin ? (
                  <Link href="/admin" className={`mt-3 flex w-full items-center justify-center rounded-xl bg-[#0B1F3A] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#15345b] ${focus}`}>
                    Admin Dashboard
                  </Link>
                ) : (
                  <Link href="/organizer-application" className={`mt-3 flex w-full items-center justify-center rounded-xl border border-[#FF7900] px-4 py-3 text-sm font-bold transition hover:bg-[#FFF3E8] ${focus}`}>
                    Apply to Organize Events
                  </Link>
                )}
              </div>
            </section>

            {/* Main column */}
            <div className="min-w-0 space-y-6">
              {/* Campus updates only reach students whose department and level
                  we know, so this is worth asking for once, plainly. */}
              {!editing && missingAcademics && (
                <section className="rounded-3xl border border-[#FF7900]/40 bg-[#FFF3E8] p-5 sm:p-6">
                  <h2 className="font-extrabold">Add your department and level</h2>
                  <p className="mt-1 text-sm leading-6 text-gray-700">
                    Campus updates are posted per department and level. Add yours and
                    you&rsquo;ll only see the notices that actually apply to you.
                  </p>
                  <button onClick={openEditor} className={`mt-4 ${primaryBtn}`}>
                    Add them now
                  </button>
                </section>
              )}

              {editing && (
                <section ref={formRef} className="scroll-mt-24 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
                  <h2 className="text-xl font-extrabold">Edit profile</h2>
                  <p className="mt-1 text-sm text-gray-600">These details are visible to other students.</p>
                  <form onSubmit={saveProfile} className="mt-6 space-y-5">
                    <div className="grid gap-5 sm:grid-cols-2">
                      <Field label="Full name" required value={form.name} onChange={set("name")} placeholder="Your full name" />
                      <Field label="University" value={form.university} onChange={set("university")} placeholder="e.g. LAUTECH" />
                      <Field
                        label="Faculty"
                        value={form.faculty}
                        onChange={set("faculty")}
                        placeholder="e.g. Engineering and Technology"
                      />
                      <Field
                        label="Department"
                        value={form.department}
                        onChange={set("department")}
                        placeholder="e.g. Mechanical Engineering"
                        hint="Spell it the way your department does, so campus updates reach you."
                      />
                      <LevelField value={form.level} onChange={set("level")} />
                    </div>
                    <div>
                      <span className="mb-2 block text-sm font-semibold">Profile photo</span>
                      <div className="flex flex-wrap items-center gap-4">
                        <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-[#FFF3E8] text-xl font-bold">
                          {form.avatar ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={form.avatar} alt="Selected profile photo preview" className="h-full w-full object-cover" />
                          ) : initials}
                        </div>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => chooseAvatar(e.target.files?.[0])}
                        />
                        <button type="button" onClick={() => avatarInputRef.current?.click()} className={ghostBtn}>
                          Choose from gallery
                        </button>
                        {form.avatar && (
                          <button type="button" onClick={() => { setForm((f) => ({ ...f, avatar: "" })); setAvatarFile(null); setRemoveAvatar(true); if (avatarInputRef.current) avatarInputRef.current.value = ""; }} className="text-sm font-semibold text-red-700 hover:underline">
                            Remove photo
                          </button>
                        )}
                      </div>
                      <p className="mt-2 text-xs text-gray-500">Select a photo from your device. Maximum size: 8 MB.</p>
                    </div>
                    <BioField value={form.bio} onChange={set("bio")} />
                    <div className="flex flex-wrap gap-3">
                      <button type="submit" disabled={saving} className={primaryBtn}>{saving ? "Saving..." : "Save profile"}</button>
                      <button type="button" onClick={closeEditor} disabled={saving} className={ghostBtn}>Cancel</button>
                    </div>
                  </form>
                </section>
              )}

              <section>
                <div role="tablist" aria-label="Profile sections" className="flex gap-6 border-b border-gray-300">
                  {(["posts", "about"] as const).map((tab) => (
                    <button
                      key={tab}
                      role="tab"
                      id={`tab-${tab}`}
                      aria-selected={activeTab === tab}
                      aria-controls={`panel-${tab}`}
                      onClick={() => setActiveTab(tab)}
                      className={`-mb-px border-b-2 px-1 pb-3 text-sm font-bold transition ${focus} ${
                        activeTab === tab ? "border-[#FF7900] text-[#0B1F3A]" : "border-transparent text-gray-500 hover:text-gray-800"
                      }`}
                    >
                      {tab === "posts" ? "My posts" : "About"}
                    </button>
                  ))}
                </div>

                {activeTab === "posts" ? (
                  <div role="tabpanel" id="panel-posts" aria-labelledby="tab-posts" className="mt-5 space-y-4">
                    {postsLoading && posts.length === 0 ? (
                      <p className="rounded-3xl border border-gray-200 bg-white px-6 py-10 text-center text-sm text-gray-600 shadow-sm">
                        Loading your posts...
                      </p>
                    ) : posts.length === 0 ? (
                      <div className="rounded-3xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
                        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF3E8]">
                          <NotebookPen size={26} className="text-[#B45309]" />
                        </div>
                        <h2 className="mt-4 text-lg font-extrabold">No posts yet</h2>
                        <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-600">
                          Posts you share in the feed will show up here.
                        </p>
                        <Link href="/create-post" className={`mt-5 inline-flex rounded-xl bg-[#0B1F3A] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#15345b] ${focus}`}>
                          Create a post
                        </Link>
                      </div>
                    ) : (
                      posts.map((post) => (
                        <article key={post.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                          <p className="text-xs text-slate-500">{timeAgo(post.created_at)}</p>
                          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{post.content}</p>

                          {/* New posts carry the whole list; older ones only
                              have the single column. */}
                          <div className="mt-3">
                            <PostImages paths={post.image_paths?.length ? post.image_paths : [post.image_path]} />
                          </div>

                          <div className="mt-4 flex items-center gap-5 border-t border-slate-100 pt-3 text-sm text-slate-600">
                            <span className="inline-flex items-center gap-2"><Heart size={16} /> {post.likes_count ?? 0}</span>
                            <span className="inline-flex items-center gap-2"><MessageCircle size={16} /> {post.comments_count ?? 0}</span>
                            <Link href={`/post/${post.id}`} className={`ml-auto font-semibold text-[#B45309] hover:underline ${focus}`}>
                              View post
                            </Link>
                          </div>
                        </article>
                      ))
                    )}
                  </div>
                ) : (
                  <div role="tabpanel" id="panel-about" aria-labelledby="tab-about" className="mt-5 rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-8">
                    <dl className="divide-y divide-gray-100">
                      {details.map(([label, value]) => (
                        <div key={label} className="flex flex-col gap-1 py-4 first:pt-0 sm:flex-row sm:justify-between">
                          <dt className="text-sm text-gray-600">{label}</dt>
                          <dd className={`break-all text-sm ${value ? "font-semibold" : "text-gray-500"}`}>{value || "Not added"}</dd>
                        </div>
                      ))}
                    </dl>
                    {!editing && <button onClick={openEditor} className={`mt-2 ${ghostBtn}`}>Update details</button>}
                  </div>
                )}
              </section>

              <section className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="font-extrabold">Account</h2>
                    <p className="mt-1 text-sm text-gray-600">Log out of Campus Plus on this device.</p>
                  </div>
                  <button onClick={logout} className={`rounded-xl border border-red-300 px-5 py-3 text-sm font-bold text-red-700 transition hover:bg-red-50 ${focus}`}>
                    Log out
                  </button>
                </div>

                {/* Campus Plus is still being tested, so make complaining easy
                    to find. Feedback nobody can reach is feedback you never get. */}
                <Link
                  href="/feedback"
                  className={`mt-5 flex items-center gap-4 rounded-2xl border border-gray-200 p-4 transition hover:border-[#FF7900]/50 hover:bg-[#FFF3E8] ${focus}`}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFF3E8] text-[#FF7900]">
                    <MessageSquare size={20} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold">Send feedback</span>
                    <span className="block text-sm text-gray-600">
                      Report a bug or suggest something
                    </span>
                  </span>
                  <span className="shrink-0 text-sm font-bold text-[#B45309]">Open</span>
                </Link>
              </section>
            </div>
          </div>
        </div>
      </div>

      <BottomNav />
    </main>
  );
}