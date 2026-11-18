"use client";

import { Suspense, useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  MapPin,
  Search,
  GraduationCap,
  Users,
  ArrowLeft,
  Clock3,
  Plus,
  X,
  Home as HomeIcon,
  ShoppingBag,
  UserRound,
  MessageCircle,
} from "lucide-react";

import BottomNav from "@/components/BottomNav";
import BrandMark from "@/components/BrandMark";
import { API_URL, API_ORIGIN } from "@/lib/api";

const navy = "#0B1F3A";
const orange = "#FF7900";

type AuthUser = {
  role?: string | null;
  is_admin?: boolean | number | string | null;
  isAdmin?: boolean | null;
  email?: string;
  [key: string]: unknown;
};

function userIsAdmin(user: AuthUser | null | undefined) {
  if (!user) return false;
  const role = String(user.role ?? "").toLowerCase();
  return (
    role === "admin" ||
    user.is_admin === true ||
    user.is_admin === 1 ||
    user.is_admin === "1" ||
    user.isAdmin === true
  );
}

type CampusEvent = {
  id: number;
  title: string;
  description?: string | null;
  category?: string | null;
  image_path?: string | null;
  venue?: string | null;
  campus?: string | null;
  starts_at?: string | null;
  attendee_limit?: number | null;
  attendees_count?: number | null;
  organizer?: { id?: number; name?: string } | null;
};

const categories = ["All", "Academic", "Social", "Sports", "Music", "Career", "Other"];

const eventsNavigationItems = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/events" },
  { label: "Chat", href: "/chat" },
  { label: "Market", href: "/market" },
  { label: "Profile", href: "/profile" },
] as const;

const footerIcons = {
  home: HomeIcon,
  events: CalendarDays,
  chat: MessageCircle,
  market: ShoppingBag,
  profile: UserRound,
} as const;

const iconNames = {
  Home: "home",
  Events: "events",
  Chat: "chat",
  Market: "market",
  Profile: "profile",
} as const;

function FooterIcon({ name }: { name: keyof typeof footerIcons }) {
  const Icon = footerIcons[name];
  return <Icon size={20} strokeWidth={1.8} aria-hidden="true" />;
}

function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-2" aria-label="Campus sections">
      {eventsNavigationItems.map(({ label, href }) => {
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(`${href}/`);
        const isChat = label === "Chat";
        const desktopLabel =
          label === "Market" ? "Marketplace" : label === "Profile" ? "My profile" : label;
        const iconName = iconNames[label as keyof typeof iconNames];

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
                <FooterIcon name={iconName} />
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
            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
              active ? "text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
            style={active ? { backgroundColor: navy } : undefined}
          >
            <FooterIcon name={iconName} />
            {desktopLabel}
          </Link>
        );
      })}
    </nav>
  );
}

function formatEventDate(dateString?: string | null) {
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;

  return {
    day: date.toLocaleDateString("en-US", { day: "2-digit" }),
    month: date.toLocaleDateString("en-US", { month: "short" }).toUpperCase(),
    full: date.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }),
  };
}

function eventImageUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_ORIGIN}/storage/${path.replace(/^\/+/, "")}`;
}

function EventCard({ event }: { event: CampusEvent }) {
  const date = formatEventDate(event.starts_at);
  const image = eventImageUrl(event.image_path);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-shadow hover:shadow-md">
      <Link href={`/events/${event.id}`} className="block" aria-label={`View ${event.title}`}>
        <div className="relative h-44 overflow-hidden bg-slate-100">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={image}
              alt={event.title}
              className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
            />
          ) : (
            <div className="flex h-full items-center justify-center bg-slate-100">
              <CalendarDays size={48} strokeWidth={1.3} className="text-slate-300" />
            </div>
          )}

          {date && (
            <div className="absolute left-3 top-3 flex h-14 w-14 flex-col items-center justify-center rounded-xl border border-slate-200 bg-white shadow-sm">
              <span className="text-lg font-bold leading-5 text-[#0B1F3A]">{date.day}</span>
              <span className="text-[10px] font-bold tracking-wide text-[#B45309]">{date.month}</span>
            </div>
          )}

          {event.category && (
            <span className="absolute right-3 top-3 rounded-full bg-white px-3 py-1 text-xs font-semibold text-[#0B1F3A] shadow-sm">
              {event.category}
            </span>
          )}
        </div>

        <div className="p-4">
          <h3 className="line-clamp-2 text-lg font-bold text-[#0B1F3A]">{event.title}</h3>

          {event.description && (
            <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-500">{event.description}</p>
          )}

          <div className="mt-4 space-y-2">
            {date && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <Clock3 size={16} className="shrink-0 text-slate-400" />
                <span>
                  {date.full} · {date.time}
                </span>
              </div>
            )}

            {(event.venue || event.campus) && (
              <div className="flex items-center gap-2 text-sm text-slate-600">
                <MapPin size={16} className="shrink-0 text-slate-400" />
                <span className="line-clamp-1">
                  {[event.venue, event.campus].filter(Boolean).join(" · ")}
                </span>
              </div>
            )}

            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Users size={16} className="shrink-0 text-slate-400" />
              <span>
                {event.attendees_count ?? 0} attending
                {event.attendee_limit ? ` · ${event.attendee_limit} capacity` : ""}
              </span>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-sm font-semibold text-slate-500">
              {event.organizer?.name ? `By ${event.organizer.name}` : "Campus event"}
            </span>
            <span className="text-sm font-bold text-[#B45309]">View event →</span>
          </div>
        </div>
      </Link>
    </article>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isApprovedOrganizer, setIsApprovedOrganizer] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<string | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creatingEvent, setCreatingEvent] = useState(false);
  const [eventImageFile, setEventImageFile] = useState<File | null>(null);
  const [eventImagePreview, setEventImagePreview] = useState<string | null>(null);
  const [createError, setCreateError] = useState("");
  const [createSuccess, setCreateSuccess] = useState("");
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    category: "Academic",
    image_path: "",
    venue: "",
    campus: "",
    starts_at: "",
    ends_at: "",
    attendee_limit: "",
  });

  // Read the authenticated user's real role from the cached profile and Laravel.
  useEffect(() => {
    let cancelled = false;

    async function loadCurrentUserRole() {
      const token = localStorage.getItem("campus_life_token");

      try {
        const cached = localStorage.getItem("campus_life_user");
        if (cached) JSON.parse(cached);
      } catch {
        localStorage.removeItem("campus_life_user");
      }

      // Do not show privileged controls from cached data before the server verifies it.
      if (!token) {
        setIsAdmin(false);
        setIsApprovedOrganizer(false);
        setApplicationStatus(null);
        setRoleLoaded(true);
        return;
      }

      try {
        const response = await fetch(`${API_URL}/user`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (response.status === 401) {
          localStorage.removeItem("campus_life_token");
          localStorage.removeItem("campus_life_user");
          if (!cancelled) {
            setIsAdmin(false);
            setIsApprovedOrganizer(false);
            setApplicationStatus(null);
            setRoleLoaded(true);
          }
          return;
        }

        if (!response.ok) {
          if (!cancelled) {
            setIsAdmin(false);
            setIsApprovedOrganizer(false);
            setApplicationStatus(null);
            setRoleLoaded(true);
          }
          return;
        }

        const result = await response.json();
        const user = (result.user ?? result) as AuthUser;
        const admin = userIsAdmin(user);

        // Also fetch the user's latest organizer application. The user profile
        // alone does not reliably tell us whether an application was approved.
        let latestApplicationStatus: string | null = null;
        let approvedOrganizer = false;

        try {
          const applicationResponse = await fetch(`${API_URL}/organizer-applications/me`, {
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
            cache: "no-store",
          });

          if (applicationResponse.ok) {
            const applicationResult = await applicationResponse.json();
            const application = applicationResult.application ?? applicationResult;
            latestApplicationStatus =
              typeof application?.status === "string" ? application.status.toLowerCase() : null;
            approvedOrganizer = latestApplicationStatus === "approved";
          }
        } catch (applicationError) {
          console.error("Could not load organizer application status:", applicationError);
        }

        if (!cancelled) {
          setIsAdmin(admin);
          setApplicationStatus(latestApplicationStatus);
          setIsApprovedOrganizer(approvedOrganizer);
          setRoleLoaded(true);
          localStorage.setItem("campus_life_user", JSON.stringify(user));
        }
      } catch (error) {
        console.error("Could not verify current user's role:", error);
        if (!cancelled) {
          setIsAdmin(false);
          setIsApprovedOrganizer(false);
          setApplicationStatus(null);
          setRoleLoaded(true);
        }
      }
    }

    loadCurrentUserRole();
    return () => {
      cancelled = true;
    };
  }, []);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(search.trim()), 300);
    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!createSuccess) return;
    const timeout = window.setTimeout(() => setCreateSuccess(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [createSuccess]);

  const [category, setCategory] = useState("All");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    async function loadEvents() {
      setLoading(true);
      setError("");

      try {
        const params = new URLSearchParams();
        if (debouncedSearch) params.set("search", debouncedSearch);
        if (category !== "All") params.set("category", category);

        const query = params.toString();
                // Without the token this reaches the API as a guest and the campus
        // scope falls back to the default school, so a student anywhere else
        // would be shown events from a campus they have never been to.
        const token = localStorage.getItem("campus_life_token");

        const response = await fetch(`${API_URL}/events${query ? `?${query}` : ""}`, {
          headers: {
            Accept: "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          signal: controller.signal,
        });

        if (!response.ok) throw new Error("Unable to load events.");

        const result = await response.json();
        const eventList = Array.isArray(result)
          ? result
          : Array.isArray(result.data)
            ? result.data
            : [];

        setEvents(eventList);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Something went wrong while loading events.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    loadEvents();
    return () => controller.abort();
  }, [debouncedSearch, category, refreshKey]);

  const canCreateEvents = isAdmin || isApprovedOrganizer;

  async function handleCreateEvent(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCreatingEvent(true);
    setCreateError("");
    setCreateSuccess("");

    const token = localStorage.getItem("campus_life_token");
    if (!token) {
      setCreateError("Please log in again to create an event.");
      setCreatingEvent(false);
      return;
    }

    try {
      const start = new Date(eventForm.starts_at);
      const end = eventForm.ends_at ? new Date(eventForm.ends_at) : null;

      if (Number.isNaN(start.getTime())) throw new Error("Enter a valid start date.");
      if (end && Number.isNaN(end.getTime())) throw new Error("Enter a valid end date.");
      if (end && end <= start) throw new Error("The end time must be after the start time.");

      const payload = new FormData();
      payload.append("title", eventForm.title.trim());
      payload.append("description", eventForm.description.trim());
      payload.append("category", eventForm.category);
      payload.append("venue", eventForm.venue.trim());
      payload.append("starts_at", start.toISOString());
      if (end) payload.append("ends_at", end.toISOString());
      if (eventForm.campus.trim()) payload.append("campus", eventForm.campus.trim());

      // Leave attendee_limit out entirely when it is optional and blank.
      if (eventForm.attendee_limit.trim()) {
        const limit = Number(eventForm.attendee_limit);
        if (!Number.isInteger(limit) || limit < 1) {
          throw new Error("Attendee limit must be a whole number greater than zero.");
        }
        payload.append("attendee_limit", String(limit));
      }

      if (eventImageFile) payload.append("image", eventImageFile);

      const response = await fetch(`${API_URL}/events`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        body: payload,
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const validation = result?.errors ? Object.values(result.errors).flat().join(" ") : "";
        throw new Error(validation || result?.message || "Could not create the event.");
      }

      setCreateSuccess("Event published successfully.");
      setShowCreateForm(false);
      setEventForm({
        title: "",
        description: "",
        category: "Academic",
        image_path: "",
        venue: "",
        campus: "",
        starts_at: "",
        ends_at: "",
        attendee_limit: "",
      });
      setEventImageFile(null);
      setEventImagePreview(null);
      setRefreshKey((key) => key + 1);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Could not create the event.");
    } finally {
      setCreatingEvent(false);
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24 text-slate-800 lg:pb-8">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
              <Link href="/" className="flex items-center gap-2">
      <BrandMark size={40} className="shrink-0 rounded-xl" />
      <span className="text-xl font-extrabold tracking-tight" style={{ color: navy }}>
        Campus <span className="text-[#FF7900]">Plus</span>
      </span>
    </Link>

          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1F3A]"
          >
            <ArrowLeft size={17} />
            <span className="hidden sm:inline">Back to feed</span>
            <span className="sm:hidden">Back</span>
          </Link>

          <nav aria-label="Desktop navigation" className="hidden items-center gap-4 lg:flex">
            {eventsNavigationItems
              .filter(({ href }) => href !== "/")
              .map(({ label, href }) => (
                <Link
                  key={label}
                  href={href}
                  className="rounded-lg px-2 py-2 text-sm font-semibold text-slate-600 hover:text-[#0B1F3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1F3A]"
                >
                  {label}
                </Link>
              ))}
          </nav>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:py-8">
        {/* Left sidebar (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Your campus</p>
            <div className="mb-5 rounded-xl p-3" style={{ backgroundColor: "#F0F4F9" }}>
              <p className="font-bold" style={{ color: navy }}>🎓 Select university</p>
              <p className="mt-1 text-xs text-slate-500">Choose your campus</p>
            </div>

            <Suspense fallback={<div className="h-64" />}>
              <SidebarNav />
            </Suspense>

            <div className="mt-6 rounded-xl p-4" style={{ backgroundColor: "#FFF3E8" }}>
              <p className="font-bold" style={{ color: navy }}>Your campus, your people.</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Discover what&apos;s happening across Nigerian universities.
              </p>
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          {/* Page heading */}
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-100">
                <CalendarDays size={25} className="text-[#FF7900]" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-[#0B1F3A] sm:text-3xl">Campus Events</h1>
                <p className="mt-1 text-sm text-slate-500">Discover what&apos;s happening on campus.</p>
              </div>
            </div>
          </div>

          {/* Organizer and admin actions */}
          {roleLoaded && (
            <div className="mb-6 flex flex-wrap items-center gap-3">
              {canCreateEvents ? (
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateForm(true);
                    setCreateError("");
                    setCreateSuccess("");
                  }}
                  className="inline-flex items-center justify-center rounded-xl bg-[#FF7900] px-5 py-3 text-sm font-bold text-[#0B1F3A] transition hover:bg-[#FF8F26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1F3A] focus-visible:ring-offset-2"
                >
                  <Plus size={17} className="mr-2" />
                  Create Event
                </button>
              ) : applicationStatus === "pending" ? (
                <span className="inline-flex items-center rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm font-bold text-amber-800">
                  Application Pending
                </span>
              ) : applicationStatus === "rejected" ? (
                <>
                  <span className="inline-flex items-center rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                    Application Rejected
                  </span>
                  <Link
                    href="/organizer-application"
                    className="inline-flex items-center rounded-xl bg-[#FF7900] px-5 py-3 text-sm font-bold text-[#0B1F3A] hover:bg-[#FF8F26]"
                  >
                    Apply Again
                  </Link>
                </>
              ) : (
                <Link
                  href="/organizer-application"
                  className="inline-flex items-center justify-center rounded-xl bg-[#FF7900] px-5 py-3 text-sm font-bold text-[#0B1F3A] transition hover:bg-[#FF8F26] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1F3A] focus-visible:ring-offset-2"
                >
                  <CalendarDays size={17} className="mr-2" />
                  Apply to Organize Events
                </Link>
              )}

              {isAdmin && (
                <Link
                  href="/admin"
                  className="inline-flex items-center justify-center rounded-xl bg-[#0B1F3A] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#17385F]"
                >
                  <Users size={17} className="mr-2" />
                  Admin Dashboard
                </Link>
              )}
            </div>
          )}

          {createSuccess && (
            <p role="status" className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">
              {createSuccess}
            </p>
          )}

          {createError && !showCreateForm && (
            <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {createError}
            </p>
          )}

          {showCreateForm && canCreateEvents && (
            <div className="mb-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold text-[#0B1F3A]">Create an Event</h2>
                  <p className="mt-1 text-sm text-slate-500">Your event will be published immediately.</p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  aria-label="Close create event form"
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1F3A]"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleCreateEvent} className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-semibold text-slate-700">
                  Event title *
                  <input
                    required
                    maxLength={255}
                    value={eventForm.title}
                    onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#FF7900] focus-visible:ring-2 focus-visible:ring-[#0B1F3A]"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Category *
                  <select
                    required
                    value={eventForm.category}
                    onChange={(e) => setEventForm({ ...eventForm, category: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-normal outline-none focus:border-[#FF7900] focus-visible:ring-2 focus-visible:ring-[#0B1F3A]"
                  >
                    {categories
                      .filter((item) => item !== "All")
                      .map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="block text-sm font-semibold text-slate-700 sm:col-span-2">
                  Description *
                  <textarea
                    required
                    maxLength={10000}
                    rows={4}
                    value={eventForm.description}
                    onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#FF7900] focus-visible:ring-2 focus-visible:ring-[#0B1F3A]"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Venue *
                  <input
                    required
                    maxLength={255}
                    value={eventForm.venue}
                    onChange={(e) => setEventForm({ ...eventForm, venue: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#FF7900] focus-visible:ring-2 focus-visible:ring-[#0B1F3A]"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Campus
                  <input
                    maxLength={255}
                    value={eventForm.campus}
                    onChange={(e) => setEventForm({ ...eventForm, campus: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#FF7900] focus-visible:ring-2 focus-visible:ring-[#0B1F3A]"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Start date and time *
                  <input
                    required
                    type="datetime-local"
                    value={eventForm.starts_at}
                    onChange={(e) => setEventForm({ ...eventForm, starts_at: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#FF7900] focus-visible:ring-2 focus-visible:ring-[#0B1F3A]"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  End date and time
                  <input
                    type="datetime-local"
                    min={eventForm.starts_at || undefined}
                    value={eventForm.ends_at}
                    onChange={(e) => setEventForm({ ...eventForm, ends_at: e.target.value })}
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#FF7900] focus-visible:ring-2 focus-visible:ring-[#0B1F3A]"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Attendee limit <span className="font-normal text-slate-400">(optional)</span>
                  <input
                    type="number"
                    min="1"
                    step="1"
                    value={eventForm.attendee_limit}
                    onChange={(e) => setEventForm({ ...eventForm, attendee_limit: e.target.value })}
                    placeholder="Leave blank for unlimited"
                    className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2.5 font-normal outline-none focus:border-[#FF7900] focus-visible:ring-2 focus-visible:ring-[#0B1F3A]"
                  />
                </label>

                <label className="block text-sm font-semibold text-slate-700">
                  Event image <span className="font-normal text-slate-400">(optional)</span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => {
                      const file = e.target.files?.[0] ?? null;
                      if (!file) {
                        setEventImageFile(null);
                        setEventImagePreview(null);
                        return;
                      }
                      if (!file.type.startsWith("image/")) {
                        setCreateError("Choose an image file.");
                        e.currentTarget.value = "";
                        return;
                      }
                      if (file.size > 5 * 1024 * 1024) {
                        setCreateError("Choose an image smaller than 5 MB.");
                        e.currentTarget.value = "";
                        return;
                      }
                      setCreateError("");
                      setEventImageFile(file);
                      setEventImagePreview(URL.createObjectURL(file));
                    }}
                    className="mt-1 block w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold file:text-[#0B1F3A] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1F3A]"
                  />
                  <span className="mt-1 block text-xs font-normal text-slate-500">
                    Select a photo from your device gallery. JPG, PNG, WEBP or GIF, up to 5 MB.
                  </span>
                  {eventImagePreview && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={eventImagePreview}
                      alt="Selected event preview"
                      className="mt-3 h-36 w-full rounded-xl border border-slate-200 object-cover"
                    />
                  )}
                </label>

                {createError && (
                  <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700 sm:col-span-2">
                    {createError}
                  </p>
                )}

                <div className="flex flex-wrap gap-3 sm:col-span-2">
                  <button
                    type="submit"
                    disabled={creatingEvent}
                    className="rounded-xl bg-[#0B1F3A] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#17385F] disabled:opacity-60"
                  >
                    {creatingEvent ? "Publishing..." : "Publish Event"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowCreateForm(false)}
                    className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* Search */}
          <div className="mb-5">
            <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm transition focus-within:border-[#FF7900]">
              <Search size={20} className="shrink-0 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search events, venues, campuses..."
                aria-label="Search events"
                className="w-full bg-transparent text-sm text-slate-800 outline-none placeholder:text-slate-400"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="text-sm font-semibold text-slate-500 hover:text-[#0B1F3A]"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Categories */}
          <div className="mb-7 flex gap-2 overflow-x-auto pb-2">
            {categories.map((item) => {
              const active = category === item;
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setCategory(item)}
                  className={`shrink-0 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-[#0B1F3A] bg-[#0B1F3A] text-white"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0B1F3A]"
                  }`}
                >
                  {item}
                </button>
              );
            })}
          </div>

          {/* Events heading and count */}
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold text-[#0B1F3A]">Discover events</h2>
              <p className="mt-1 text-sm text-slate-500">Find your next campus experience.</p>
            </div>
            {!loading && (
              <span className="shrink-0 rounded-full bg-white px-3 py-1 text-sm font-semibold text-slate-600 ring-1 ring-slate-200">
                {events.length} {events.length === 1 ? "event" : "events"}
              </span>
            )}
          </div>

          {/* Loading */}
          {loading && (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {[1, 2, 3].map((item) => (
                <div key={item} className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                  <div className="h-44 animate-pulse bg-slate-100" />
                  <div className="space-y-3 p-4">
                    <div className="h-5 w-3/4 animate-pulse rounded bg-slate-100" />
                    <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
                    <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-white p-6 text-center">
              <p className="font-semibold text-red-700">Could not load events</p>
              <p className="mt-2 text-sm text-slate-500">{error}</p>
              <button
                type="button"
                onClick={() => setRefreshKey((key) => key + 1)}
                className="mt-4 rounded-xl bg-[#0B1F3A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17385f]"
              >
                Try again
              </button>
            </div>
          )}

          {/* Events grid */}
          {!loading && !error && events.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}

          {/* Empty state */}
          {!loading && !error && events.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50">
                {search || category !== "All" ? (
                  <Search size={30} className="text-[#FF7900]" />
                ) : (
                  <GraduationCap size={32} className="text-[#FF7900]" />
                )}
              </div>
              <h3 className="mt-5 text-lg font-bold text-[#0B1F3A]">
                {search || category !== "All" ? "No matching events" : "No events yet"}
              </h3>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-500">
                {search || category !== "All"
                  ? "Try another search or choose a different category."
                  : "When campus events are published, they will appear here. Check back soon!"}
              </p>
              {(search || category !== "All") && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setCategory("All");
                  }}
                  className="mt-5 rounded-xl bg-[#0B1F3A] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#17385f]"
                >
                  Clear filters
                </button>
              )}
            </div>
          )}
        </main>
      </div>

      <BottomNav />
    </div>
  );
}
