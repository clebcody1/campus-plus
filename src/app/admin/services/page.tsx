"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Store, LoaderCircle, Sparkles, Eye, Search, X, AlertCircle,
  EyeOff, Clock, GraduationCap,
} from "lucide-react";
import { API_URL, storageUrl } from "@/lib/api";
import { SERVICE_CATEGORIES } from "@/components/ServiceForm";

type Service = {
  id: number;
  name: string;
  category: string;
  location?: string | null;
  university?: string | null;
  image_path?: string | null;
  is_active: boolean;
  is_promoted?: boolean;
  promoted_until?: string | null;
  free_feature_used?: boolean;
  views?: number;
  owner?: { id: number; name?: string } | null;
  rating: { count: number; average: number };
};

const categoryLabel = (id: string) =>
  SERVICE_CATEGORIES.find((c) => c.id === id)?.label ?? id;

/** What one tap adds. The free fortnight is the launch offer. */
const PROMOTE_OPTIONS = [
  { days: 7, label: "+1 week" },
  { days: 30, label: "+1 month" },
  { days: 14, label: "+2 wks free" },
];

const NO_SCHOOL = "Not set";

const schoolOf = (service: Service) => service.university?.trim() || NO_SCHOOL;

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

/** Whole days from now until the promotion ends. Can be 0 (today). */
function daysLeft(value?: string | null) {
  if (!value) return null;
  const end = new Date(value).getTime();
  if (Number.isNaN(end)) return null;
  return Math.max(0, Math.ceil((end - Date.now()) / 86400000));
}

export default function AdminServicesPage() {
  const [featured, setFeatured] = useState<Service[]>([]);
  const [others, setOthers] = useState<Service[]>([]);
  const [expiringSoon, setExpiringSoon] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [school, setSchool] = useState("all");
  const [busyId, setBusyId] = useState<number | null>(null);

  const authHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem("campus_life_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/admin/services`, {
        headers: { Accept: "application/json", ...authHeaders() },
        cache: "no-store",
      });

      if (response.status === 403) throw new Error("Your account does not have admin permission.");
      if (response.status === 401) throw new Error("Your session has expired. Please log in again.");
      if (!response.ok) throw new Error("Could not load services.");

      const data = await response.json();
      setFeatured(Array.isArray(data.featured) ? data.featured : []);
      setOthers(Array.isArray(data.others) ? data.others : []);
      setExpiringSoon(Number(data.expiring_soon ?? 0));
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Couldn't reach the server. Please check your connection."
          : err instanceof Error
            ? err.message
            : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, [authHeaders]);

  useEffect(() => {
    load();
  }, [load]);

  async function promote(serviceId: number, days: number) {
    setBusyId(serviceId);

    try {
      const response = await fetch(`${API_URL}/admin/services/${serviceId}/promote`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ days }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not update the promotion.");

      // Reload rather than patching in place: a listing that just became
      // featured has to move out of one list and into the other, in the
      // right position by expiry.
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusyId(null);
    }
  }

  /*
   | This screen is the one place that deliberately ignores the campus scope,
   | because promotions are your business across every school. That also makes
   | it the one place a LAUTECH barber and a UNILAG tailor sit in the same
   | list with nothing to tell them apart, hence the filter.
   |
   | Built from what actually loaded, so you never pick a school that returns
   | an empty page.
   */
  const schools = useMemo(() => {
    const seen = new Set<string>();
    [...featured, ...others].forEach((service) => seen.add(schoolOf(service)));
    return Array.from(seen).sort((a, b) => a.localeCompare(b));
  }, [featured, others]);

  const query = search.trim().toLowerCase();
  const matches = (service: Service) => {
    const matchesSchool = school === "all" || schoolOf(service) === school;
    const matchesQuery =
      !query ||
      service.name.toLowerCase().includes(query) ||
      (service.owner?.name ?? "").toLowerCase().includes(query) ||
      (service.location ?? "").toLowerCase().includes(query);

    return matchesSchool && matchesQuery;
  };

  const visibleFeatured = featured.filter(matches);
  const visibleOthers = others.filter(matches);

  const filtering = school !== "all" || Boolean(query);

  function Row({ service }: { service: Service }) {
    const image = storageUrl(service.image_path);
    const left = daysLeft(service.promoted_until);
    const busy = busyId === service.id;

    // Three days or fewer is the window where a renewal conversation still
    // has time to happen.
    const urgent = service.is_promoted && left !== null && left <= 3;

    return (
      <li
        className={`rounded-2xl border bg-white p-3 shadow-sm ${
          urgent ? "border-amber-300" : "border-slate-200"
        }`}
      >
        <div className="flex gap-3">
          <Link
            href={`/services/${service.id}`}
            className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100"
          >
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-slate-300">
                <Store size={20} />
              </span>
            )}
          </Link>

          <div className="min-w-0 flex-1">
            <Link href={`/services/${service.id}`} className="block">
              <h3 className="truncate font-bold text-[#0B1F3A]">{service.name}</h3>
              <p className="truncate text-xs text-slate-500">
                {categoryLabel(service.category)}
                {service.owner?.name ? ` · ${service.owner.name}` : ""}
                {service.location ? ` · ${service.location}` : ""}
              </p>
            </Link>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {/* First chip, always present: with every school in one list,
                  this is the thing you need before anything else on the row
                  means something. */}
              <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-[#0B1F3A]">
                <GraduationCap size={10} />
                {schoolOf(service)}
              </span>

              {!service.is_active && (
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-inset ring-amber-200">
                  <EyeOff size={10} /> Paused
                </span>
              )}

              {service.is_promoted && left !== null && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                    urgent ? "bg-amber-100 text-amber-900" : "bg-[#0B1F3A] text-white"
                  }`}
                >
                  <Clock size={10} />
                  {left === 0 ? "Ends today" : `${left} day${left === 1 ? "" : "s"} left`}
                  {" · "}
                  {formatDate(service.promoted_until)}
                </span>
              )}

              <span className="flex items-center gap-1 text-slate-600">
                <Eye size={12} className="shrink-0" />
                <span className="font-bold text-[#0B1F3A]">{service.views ?? 0}</span>
                opens
              </span>

              {!service.is_promoted && !service.free_feature_used && (
                <span className="text-[11px] font-semibold text-slate-400">
                  Free week unused
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2 border-t border-slate-100 pt-3">
          {PROMOTE_OPTIONS.map((option) => (
            <button
              key={option.days}
              type="button"
              onClick={() => promote(service.id, option.days)}
              disabled={busy}
              className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-[#0B1F3A] transition hover:bg-slate-50 disabled:opacity-50"
            >
              {option.label}
            </button>
          ))}

          {service.is_promoted && (
            <button
              type="button"
              onClick={() => promote(service.id, 0)}
              disabled={busy}
              className="ml-auto rounded-xl border border-red-300 bg-white px-3 py-2 text-xs font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-50"
            >
              Stop
            </button>
          )}

          {busy && (
            <span className="flex items-center gap-1.5 text-xs text-slate-500">
              <LoaderCircle size={13} className="animate-spin" /> Saving
            </span>
          )}
        </div>
      </li>
    );
  }

  return (
    <main className="min-h-screen bg-[#F0F4F9] pb-16">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            href="/admin"
            aria-label="Back to admin"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-[#0B1F3A] transition hover:bg-slate-50"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold text-[#0B1F3A]">Service promotions</h1>
            <p className="truncate text-xs text-slate-500">
              {loading
                ? "Loading..."
                : `${featured.length} featured · ${others.length} not featured${
                    schools.length > 1 ? ` · ${schools.length} schools` : ""
                  }`}
            </p>
          </div>
        </div>

        <div className="space-y-2 px-4 pb-3">
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute inset-y-0 left-4 my-auto text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search a business, owner or location..."
              aria-label="Search listings"
              className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-11 pr-10 text-base text-[#0B1F3A] placeholder:text-slate-400 outline-none focus:border-[#FF7900] focus:ring-2 focus:ring-orange-100"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                aria-label="Clear search"
                className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-slate-400 hover:text-[#0B1F3A]"
              >
                <X size={16} />
              </button>
            )}
          </div>

          {/* Hidden while only one school has listings, which is the state
              you are in today. It appears on its own the first time a second
              campus posts something. */}
          {schools.length > 1 && (
            <div className="relative">
              <GraduationCap
                size={18}
                className="pointer-events-none absolute inset-y-0 left-4 my-auto text-slate-400"
              />
              <select
                value={school}
                onChange={(e) => setSchool(e.target.value)}
                aria-label="Filter by school"
                className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-11 pr-4 text-base font-semibold text-[#0B1F3A] outline-none focus:border-[#FF7900] focus:ring-2 focus:ring-orange-100"
              >
                <option value="all">All schools</option>
                {schools.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5">
        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {/* Fires three days out, which is while the listing is still at the
            top and the open count is still climbing. The vendor has already
            been notified in the app by then; this is here so you can see it
            at a glance without opening every listing.

            Deliberately counts every school, whatever the filter says — a
            promotion you cannot see is still a promotion that is ending. */}
        {!loading && expiringSoon > 0 && (
          <p className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            {expiringSoon} {expiringSoon === 1 ? "promotion ends" : "promotions end"} within three
            days. Those vendors have been notified in the app.
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-600">
            <LoaderCircle size={20} className="animate-spin text-[#FF7900]" />
            Loading listings...
          </div>
        ) : (
          <>
            <section className="mb-6">
              <h2 className="mb-2 flex items-center gap-1.5 text-sm font-extrabold uppercase tracking-wide text-[#0B1F3A]">
                <Sparkles size={15} className="text-[#FF7900]" />
                Featured now
                <span className="font-semibold text-slate-400">
                  ({visibleFeatured.length})
                </span>
              </h2>

              {visibleFeatured.length === 0 ? (
                <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                  {filtering
                    ? "Nothing featured matches that filter."
                    : "Nothing is featured right now."}
                </p>
              ) : (
                <ul className="space-y-3">
                  {visibleFeatured.map((service) => (
                    <Row key={service.id} service={service} />
                  ))}
                </ul>
              )}
            </section>

            <section>
              <h2 className="mb-2 text-sm font-extrabold uppercase tracking-wide text-[#0B1F3A]">
                Not featured
                <span className="ml-1 font-semibold text-slate-400">
                  ({visibleOthers.length})
                </span>
              </h2>

              {visibleOthers.length === 0 ? (
                <p className="rounded-2xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">
                  {filtering ? "Nothing matched that filter." : "Every listing is featured."}
                </p>
              ) : (
                <ul className="space-y-3">
                  {visibleOthers.map((service) => (
                    <Row key={service.id} service={service} />
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}