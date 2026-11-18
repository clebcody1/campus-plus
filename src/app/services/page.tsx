"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft, Search, Star, MapPin, Plus, LoaderCircle, Store, X, GraduationCap,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import FeaturedServices from "@/components/FeaturedServices";
import { API_URL, storageUrl } from "@/lib/api";
import { SERVICE_CATEGORIES } from "@/components/ServiceForm";

type Service = {
  id: number;
  name: string;
  category: string;
  description?: string | null;
  location?: string | null;
  university?: string | null;
  price_from?: string | number | null;
  image_path?: string | null;
  is_promoted?: boolean;
  owner?: { id: number; name?: string; is_verified?: boolean } | null;
  rating: { count: number; average: number };
};

const categoryLabel = (id: string) =>
  SERVICE_CATEGORIES.find((c) => c.id === id)?.label ?? id;

/**
 * The campus a shared link is pointing at.
 *
 * Read straight off window.location rather than useSearchParams(), which
 * in Next 15 forces the whole page behind a Suspense boundary or fails the
 * build. This page already fetches client-side, so there is nothing gained
 * by going through the hook.
 *
 * The server ignores this entirely for a signed-in student, so sending it
 * always is safe.
 */
function campusParam() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("university")?.trim() ?? "";
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={13}
          className={n <= Math.round(value) ? "fill-[#FF7900] text-[#FF7900]" : "text-slate-300"}
        />
      ))}
    </span>
  );
}

function naira(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 0 });
}

export default function ServicesPage() {
  const [services, setServices] = useState<Service[]>([]);
  const [featured, setFeatured] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  const [loggedIn, setLoggedIn] = useState(false);

  useEffect(() => {
    try {
      setLoggedIn(Boolean(localStorage.getItem("campus_life_token")));
    } catch {
      // Private browsing can refuse storage. Treat it as signed out.
    }
  }, []);

  // Wait until typing stops before searching, so one word is one request
  // rather than six.
  useEffect(() => {
    const timer = setTimeout(() => setQuery(search.trim()), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (category) params.set("category", category);

    // Carried through so a listing shared on WhatsApp opens on the right
    // campus for somebody who has no account yet.
    const campus = campusParam();
    if (campus) params.set("university", campus);

    try {
      const token = localStorage.getItem("campus_life_token");

      const response = await fetch(`${API_URL}/services?${params.toString()}`, {
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Could not load services.");

      const data = await response.json();
      setServices(Array.isArray(data.services) ? data.services : []);
      setFeatured(Array.isArray(data.featured) ? data.featured : []);
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
  }, [query, category]);

  useEffect(() => {
    load();
  }, [load]);

  const filtering = Boolean(query || category);

  /*
   | The carousel only appears on the unfiltered directory. Someone who
   | searched "barber" wants barbers, and showing them a promoted tailor
   | above the results is the kind of thing that makes people stop trusting
   | a search box.
   */
  const showFeatured = !filtering && featured.length > 0;

  /*
   | A guest is always looking at exactly one campus, chosen by the link
   | they followed or the default. Saying which one out loud stops the
   | obvious confusion: a UI student opening a shared LAUTECH link and
   | wondering why none of these businesses are near them.
   */
  const guestCampus = !loggedIn
    ? services[0]?.university ?? featured[0]?.university ?? campusParam()
    : "";

  return (
    <main className="min-h-screen bg-[#F0F4F9] pb-28">
      <header className="sticky top-0 z-20 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <Link
            href="/"
            aria-label="Back to home"
            className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-[#0B1F3A] transition hover:bg-slate-50"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0 flex-1">
            <h1 className="text-lg font-extrabold text-[#0B1F3A]">Services</h1>
            <p className="truncate text-xs text-slate-500">
              Barbers, tailors, food, laundry and more, run by students
            </p>
          </div>

          {loggedIn && (
            <div className="flex shrink-0 items-center gap-2">
              <Link
                href="/services/mine"
                aria-label="My services"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-300 px-3 text-sm font-bold text-[#0B1F3A] transition hover:bg-slate-50"
              >
                <Store size={16} /> Mine
              </Link>
              <Link
                href="/services/new"
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#FF7900] px-3 text-sm font-bold text-white transition hover:opacity-90"
              >
                <Plus size={16} /> List
              </Link>
            </div>
          )}
        </div>

        <div className="px-4 pb-3">
          <div className="relative">
            <Search
              size={18}
              className="pointer-events-none absolute inset-y-0 left-4 my-auto text-slate-400"
            />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search barber, food, laundry, hostel..."
              aria-label="Search services"
              className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-10 text-base text-[#0B1F3A] placeholder:text-slate-400 outline-none focus:border-[#FF7900] focus:ring-2 focus:ring-orange-100"
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
        </div>

        {/* Category chips. Horizontal scroll so they never wrap into a wall
            of buttons on a phone. */}
        <div className="flex gap-2 overflow-x-auto px-4 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setCategory("")}
            aria-pressed={category === ""}
            className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
              category === ""
                ? "border-transparent bg-[#0B1F3A] text-white"
                : "border-slate-200 bg-white text-slate-600"
            }`}
          >
            All
          </button>
          {SERVICE_CATEGORIES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setCategory(category === option.id ? "" : option.id)}
              aria-pressed={category === option.id}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${
                category === option.id
                  ? "border-transparent bg-[#0B1F3A] text-white"
                  : "border-slate-200 bg-white text-slate-600"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5">
        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {!loading && guestCampus && (
          <div className="mb-4 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-slate-200 bg-white p-3 text-sm">
            <GraduationCap size={16} className="shrink-0 text-[#FF7900]" />
            <span className="text-slate-600">
              Showing businesses at <strong className="text-[#0B1F3A]">{guestCampus}</strong>
            </span>
            <Link href="/login" className="ml-auto font-bold text-[#B45309] hover:underline">
              Sign in for your campus
            </Link>
          </div>
        )}

        {/* Paid placement, auto-advancing, labelled as promoted on every
            card. The listings here also still appear in the normal list
            below: promotion buys extra exposure, not a place in the queue. */}
        {!loading && showFeatured && (
          <div className="mb-6">
            <FeaturedServices variant="strip" services={featured} />
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-600">
            <LoaderCircle size={20} className="animate-spin text-[#FF7900]" />
            Loading services...
          </div>
        ) : services.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#FF7900]">
              <Store size={26} />
            </span>
            <h2 className="mt-4 text-lg font-bold text-[#0B1F3A]">
              {filtering ? "Nothing matched" : "No services listed yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
              {filtering
                ? "Try a different word, or clear the filters to see everything."
                : "Barbers, tailors, food vendors and laundry services will show up here. Run one? List it and students will find you."}
            </p>
            {filtering ? (
              <button
                type="button"
                onClick={() => {
                  setSearch("");
                  setCategory("");
                }}
                className="mt-5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Clear filters
              </button>
            ) : (
              loggedIn && (
                <Link
                  href="/services/new"
                  className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#FF7900] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
                >
                  <Plus size={16} /> List your business
                </Link>
              )
            )}
          </div>
        ) : (
          <>
            <p className="mb-3 text-sm font-semibold text-slate-600">
              {services.length} {services.length === 1 ? "service" : "services"}
            </p>

            <ul className="space-y-3">
              {services.map((service) => {
                const image = storageUrl(service.image_path);
                const price = naira(service.price_from);

                return (
                  <li key={service.id}>
                    <Link
                      href={`/services/${service.id}`}
                      className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md"
                    >
                      <div className="h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-slate-100">
                        {image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={image}
                            alt=""
                            loading="lazy"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-slate-300">
                            <Store size={26} />
                          </span>
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h2 className="truncate font-bold text-[#0B1F3A]">{service.name}</h2>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                            {categoryLabel(service.category)}
                          </span>
                        </div>

                        {service.rating.count > 0 ? (
                          <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-600">
                            <Stars value={service.rating.average} />
                            <span className="font-bold text-[#0B1F3A]">
                              {service.rating.average.toFixed(1)}
                            </span>
                            <span>({service.rating.count})</span>
                          </span>
                        ) : (
                          <span className="mt-1 block text-xs text-slate-400">No reviews yet</span>
                        )}

                        {service.description && (
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">
                            {service.description}
                          </p>
                        )}

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
                          {service.location && (
                            <span className="flex min-w-0 items-center gap-1">
                              <MapPin size={12} className="shrink-0" />
                              <span className="truncate">{service.location}</span>
                            </span>
                          )}
                          {price && (
                            <span className="font-bold text-[#B45309]">from {price}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>

      <BottomNav />
    </main>
  );
}