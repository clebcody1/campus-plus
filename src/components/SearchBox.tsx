"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Search, X, CalendarDays, ShoppingBag, UserRound, Loader2,
} from "lucide-react";
import { API_URL, storageUrl } from "@/lib/api";
import VerifiedBadge from "@/components/VerifiedBadge";

const navy = "#0B1F3A";

type UserHit = {
  id: number;
  name: string;
  username?: string | null;
  university?: string | null;
  avatar_path?: string | null;
  is_verified?: boolean;
  role?: string;
};

type EventHit = {
  id: number;
  title?: string;
  venue?: string | null;
  campus?: string | null;
  starts_at?: string | null;
};

type ListingHit = {
  id: number | string;
  title: string;
  price?: number | string | null;
  images?: string[] | null;
};

function naira(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0,
      }).format(amount)
    : `₦${value}`;
}

function shortDate(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

// The API paginates, so results arrive as { data: [...] }. Cope with the
// other shapes too, in case an endpoint returns a bare array.
function rowsOf<T>(result: unknown): T[] {
  if (Array.isArray(result)) return result as T[];
  const r = result as Record<string, unknown>;
  const candidate = r?.data ?? r?.events ?? r?.listings ?? r?.users;
  if (Array.isArray(candidate)) return candidate as T[];
  if (candidate && Array.isArray((candidate as Record<string, unknown>).data)) {
    return (candidate as { data: T[] }).data;
  }
  return [];
}

async function getJson(path: string, signal: AbortSignal) {
  const token = window.localStorage.getItem("campus_life_token");
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    cache: "no-store",
    signal,
  });
  if (!response.ok) throw new Error(String(response.status));
  return response.json();
}

export default function SearchBox({
  placeholder = "Search students, events, or items...",
}: {
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const [users, setUsers] = useState<UserHit[]>([]);
  const [events, setEvents] = useState<EventHit[]>([]);
  const [listings, setListings] = useState<ListingHit[]>([]);

  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const term = query.trim();
  const ready = term.length >= 2;
  const empty = ready && !busy && !users.length && !events.length && !listings.length;

  // Close on a click outside the box, or on Escape.
  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (!boxRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        inputRef.current?.blur();
      }
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Search 250ms after the student stops typing. The server does all the
  // filtering: /users/search takes ?q=, the other two take ?search=.
  useEffect(() => {
    if (!ready) {
      setUsers([]);
      setEvents([]);
      setListings([]);
      setBusy(false);
      return;
    }

    const controller = new AbortController();
    const encoded = encodeURIComponent(term);
    setBusy(true);

    const timer = window.setTimeout(async () => {
      const [userResult, eventResult, listingResult] = await Promise.allSettled([
        getJson(`/users/search?q=${encoded}`, controller.signal),
        getJson(`/events?search=${encoded}`, controller.signal),
        getJson(`/marketplace?search=${encoded}`, controller.signal),
      ]);

      if (controller.signal.aborted) return;

      setUsers(userResult.status === "fulfilled" ? rowsOf<UserHit>(userResult.value).slice(0, 5) : []);
      setEvents(eventResult.status === "fulfilled" ? rowsOf<EventHit>(eventResult.value).slice(0, 4) : []);
      setListings(listingResult.status === "fulfilled" ? rowsOf<ListingHit>(listingResult.value).slice(0, 4) : []);

      setBusy(false);
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [term, ready]);

  function close() {
    setOpen(false);
    setQuery("");
  }

  const sectionTitle = "px-3 pb-1 pt-3 text-xs font-bold uppercase tracking-widest text-slate-400";
  const row = "flex items-center gap-3 rounded-xl px-3 py-2.5 transition hover:bg-slate-50";
  const tile = "flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#FFF3E8] text-[#B45309]";

  return (
    <div ref={boxRef} className="relative">
      <label className="flex items-center gap-3 rounded-xl bg-slate-100 px-4 py-3">
        <Search size={18} aria-hidden="true" className="shrink-0 text-slate-500" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          aria-label="Search Campus Plus"
          placeholder={placeholder}
          className="w-full bg-transparent text-base outline-none placeholder:text-slate-500 sm:text-sm"
        />
        {busy && <Loader2 size={16} className="shrink-0 animate-spin text-slate-400" />}
        {query && !busy && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            aria-label="Clear search"
            className="shrink-0 rounded-full p-0.5 text-slate-500 hover:bg-slate-200"
          >
            <X size={16} />
          </button>
        )}
      </label>

      {open && query.length > 0 && (
        <div className="absolute inset-x-0 top-full z-50 mt-2 max-h-[70vh] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white p-1 shadow-xl">
          {!ready && (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              Keep typing — at least 2 letters.
            </p>
          )}

          {empty && (
            <p className="px-4 py-6 text-center text-sm text-slate-500">
              Nothing found for &ldquo;{term}&rdquo;.
            </p>
          )}

          {users.length > 0 && (
            <>
              <p className={sectionTitle}>Students</p>
              {users.map((user) => (
                <Link key={user.id} href={`/users/${user.id}`} onClick={close} className={row}>
                  <Avatar name={user.name} src={storageUrl(user.avatar_path)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-sm font-bold" style={{ color: navy }}>
                      {user.name}
                      {user.is_verified && (
                        <VerifiedBadge className="h-4 w-4" admin={user.role === "admin"} />
                      )}
                    </span>
                    {(user.username || user.university) && (
                      <span className="block truncate text-xs text-slate-500">
                        {user.username ? `@${user.username}` : ""}
                        {user.username && user.university ? " · " : ""}
                        {user.university ?? ""}
                      </span>
                    )}
                  </span>
                  <UserRound size={16} className="shrink-0 text-slate-300" aria-hidden="true" />
                </Link>
              ))}
            </>
          )}

          {events.length > 0 && (
            <>
              <p className={sectionTitle}>Events</p>
              {events.map((event) => {
                const where = event.venue || event.campus || "Location to be announced";
                const when = shortDate(event.starts_at);
                return (
                  <Link key={event.id} href={`/events/${event.id}`} onClick={close} className={row}>
                    <span className={tile}>
                      <CalendarDays size={19} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold" style={{ color: navy }}>
                        {event.title ?? "Campus event"}
                      </span>
                      <span className="block truncate text-xs text-slate-500">
                        {when ? `${when} · ` : ""}{where}
                      </span>
                    </span>
                  </Link>
                );
              })}
            </>
          )}

          {listings.length > 0 && (
            <>
              <p className={sectionTitle}>Marketplace</p>
              {listings.map((listing) => {
                const thumb = storageUrl(listing.images?.[0]);
                return (
                  <Link key={listing.id} href={`/market/${listing.id}`} onClick={close} className={row}>
                    <span className={tile}>
                      {thumb ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumb} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <ShoppingBag size={19} />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold" style={{ color: navy }}>
                        {listing.title}
                      </span>
                      {naira(listing.price) && (
                        <span className="block truncate text-xs font-semibold text-[#B45309]">
                          {naira(listing.price)}
                        </span>
                      )}
                    </span>
                  </Link>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Small local avatar so this component works on its own.
function Avatar({ name, src }: { name: string; src?: string | null }) {
  const [failed, setFailed] = useState(false);
  const initial = (name.trim().charAt(0) || "S").toUpperCase();

  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-100 text-sm font-bold text-orange-700">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}