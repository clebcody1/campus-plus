"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Sparkles, Star, MapPin, Store, ArrowRight } from "lucide-react";
import { API_URL, storageUrl } from "@/lib/api";
import { SERVICE_CATEGORIES } from "@/components/ServiceForm";

/*
 | How long each card holds before the next one slides in.
 |
 | Three seconds is what was asked for. Four or five reads more comfortably
 | — three is about the time it takes to notice a card, not to read it — so
 | if vendors say students aren't seeing their name, raise this first.
 */
const AUTO_ADVANCE_MS = 3000;

export type FeaturedService = {
  id: number;
  name: string;
  category: string;
  description?: string | null;
  location?: string | null;
  price_from?: string | number | null;
  image_path?: string | null;
  rating: { count: number; average: number };
};

const categoryLabel = (id: string) =>
  SERVICE_CATEGORIES.find((c) => c.id === id)?.label ?? id;

function naira(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 0 });
}

function Stars({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={12}
          className={n <= Math.round(value) ? "fill-[#FF7900] text-[#FF7900]" : "text-slate-300"}
        />
      ))}
    </span>
  );
}

/**
 * The featured (paid) services carousel.
 *
 * `variant` decides the shape:
 *   "strip"  — a row of cards, for the top of the services directory
 *   "banner" — one wide card at a time, for the home page
 *
 * Pass `services` when the parent already has them, to avoid a second
 * request. Leave it out and the component fetches its own.
 */
export default function FeaturedServices({
  variant = "strip",
  services: provided,
}: {
  variant?: "strip" | "banner";
  services?: FeaturedService[];
}) {
  const [services, setServices] = useState<FeaturedService[]>(provided ?? []);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const listRef = useRef<HTMLUListElement>(null);

  // Keep in step when the parent reloads its own data.
  useEffect(() => {
    if (provided) setServices(provided);
  }, [provided]);

  // Fetch only when the parent didn't supply anything.
  useEffect(() => {
    if (provided) return;

    let cancelled = false;

    fetch(`${API_URL}/services`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        setServices(Array.isArray(data?.featured) ? data.featured : []);
      })
      .catch(() => {
        // Nothing featured is a normal state, so a failure here stays quiet.
      });

    return () => {
      cancelled = true;
    };
  }, [provided]);

  const count = services.length;

  /*
   | Some people get motion sickness from things that move on their own, and
   | phones have a setting for it. Honour it: they still get the carousel,
   | it just waits for their thumb.
   */
  const [reducedMotion, setReducedMotion] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(query.matches);

    const onChange = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // The timer. Stops while a finger is on it, while the tab is hidden, and
  // when there is only one card to show.
  useEffect(() => {
    if (count < 2 || paused || reducedMotion) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      setIndex((current) => (current + 1) % count);
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [count, paused, reducedMotion]);

  // Slide the strip to whichever card is current. Scrolls the container
  // only, never the page.
  useEffect(() => {
    if (variant !== "strip") return;
    const list = listRef.current;
    const card = list?.children[index] as HTMLElement | undefined;
    if (!list || !card) return;

    list.scrollTo({ left: card.offsetLeft - list.offsetLeft, behavior: "smooth" });
  }, [index, variant]);

  const hold = useCallback(() => setPaused(true), []);
  const release = useCallback(() => setPaused(false), []);

  if (count === 0) return null;

  const heading = (
    <div className="mb-2 flex items-center gap-1.5">
      <Sparkles size={15} className="text-[#FF7900]" />
      <h2 className="text-sm font-extrabold uppercase tracking-wide text-[#0B1F3A]">Featured</h2>
      <span className="text-xs font-semibold text-slate-400">Promoted</span>
    </div>
  );

  const dots = count > 1 && (
    <div className="mt-2 flex justify-center gap-1.5">
      {services.map((service, i) => (
        <button
          key={service.id}
          type="button"
          onClick={() => setIndex(i)}
          aria-label={`Show featured business ${i + 1} of ${count}`}
          aria-current={i === index}
          className={`h-1.5 rounded-full transition-all ${
            i === index ? "w-5 bg-[#FF7900]" : "w-1.5 bg-slate-300"
          }`}
        />
      ))}
    </div>
  );

  /* ---------- banner: one wide card at a time ---------- */

  if (variant === "banner") {
    const service = services[index];
    const image = storageUrl(service.image_path);
    const price = naira(service.price_from);

    return (
      <section
        aria-label="Featured businesses"
        onMouseEnter={hold}
        onMouseLeave={release}
        onTouchStart={hold}
        onTouchEnd={release}
      >
        {heading}

        <Link
          key={service.id}
          href={`/services/${service.id}`}
          className="flex animate-[fadeIn_250ms_ease-out] items-center gap-3 rounded-2xl border border-orange-200 bg-white p-3 shadow-sm transition hover:shadow-md"
        >
          <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-slate-300">
                <Store size={22} />
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[#0B1F3A]">{service.name}</p>
            <p className="truncate text-xs text-slate-500">
              {categoryLabel(service.category)}
              {service.location ? ` · ${service.location}` : ""}
            </p>
            <span className="mt-0.5 flex items-center gap-2">
              {service.rating.count > 0 ? (
                <>
                  <Stars value={service.rating.average} />
                  <span className="text-xs font-bold text-[#0B1F3A]">
                    {service.rating.average.toFixed(1)}
                  </span>
                </>
              ) : (
                <span className="text-xs text-slate-400">New</span>
              )}
              {price && <span className="text-xs font-bold text-[#B45309]">from {price}</span>}
            </span>
          </div>

          <ArrowRight size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
        </Link>

        {dots}
      </section>
    );
  }

  /* ---------- strip: a row of cards ---------- */

  return (
    <section
      aria-label="Featured businesses"
      onMouseEnter={hold}
      onMouseLeave={release}
      onTouchStart={hold}
      onTouchEnd={release}
    >
      {heading}

      <ul
        ref={listRef}
        className="flex gap-3 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {services.map((service) => {
          const image = storageUrl(service.image_path);
          const price = naira(service.price_from);

          return (
            <li key={service.id} className="w-44 shrink-0">
              <Link
                href={`/services/${service.id}`}
                className="block overflow-hidden rounded-2xl border border-orange-200 bg-white shadow-sm transition hover:shadow-md"
              >
                <div className="relative h-28 w-full bg-slate-100">
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
                      <Store size={24} />
                    </span>
                  )}
                  <span className="absolute left-2 top-2 rounded-full bg-[#0B1F3A]/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                    Promoted
                  </span>
                </div>

                <div className="p-3">
                  <h3 className="truncate text-sm font-bold text-[#0B1F3A]">{service.name}</h3>
                  <p className="truncate text-xs text-slate-500">
                    {categoryLabel(service.category)}
                  </p>

                  {service.rating.count > 0 ? (
                    <span className="mt-1 flex items-center gap-1 text-xs text-slate-600">
                      <Stars value={service.rating.average} />
                      <span className="font-bold text-[#0B1F3A]">
                        {service.rating.average.toFixed(1)}
                      </span>
                    </span>
                  ) : (
                    <span className="mt-1 block text-xs text-slate-400">New</span>
                  )}

                  {service.location && (
                    <p className="mt-1 flex items-center gap-1 truncate text-xs text-slate-500">
                      <MapPin size={11} className="shrink-0" />
                      <span className="truncate">{service.location}</span>
                    </p>
                  )}

                  {price && (
                    <p className="mt-1 text-xs font-bold text-[#B45309]">from {price}</p>
                  )}
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {dots}
    </section>
  );
}