"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  MapPin,
  Users,
  GraduationCap,
  Image as ImageIcon,
} from "lucide-react";
import BrandMark from "@/components/BrandMark";
import { API_URL, API_ORIGIN } from "@/lib/api";

type CampusEvent = {
  id: number;
  title: string;
  description?: string | null;
  category?: string | null;
  image_path?: string | null;
  venue?: string | null;
  campus?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  attendee_limit?: number | null;
  attendees_count?: number | null;
  organizer?: { id?: number; name?: string | null; email?: string | null } | null;
};

function eventImageUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  const cleanPath = path.replace(/^\/+/, "");
  if (cleanPath.startsWith("storage/")) return `${API_ORIGIN}/${cleanPath}`;
  return `${API_ORIGIN}/storage/${cleanPath}`;
}

function formatDateTime(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return {
    date: date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function EventDetailsContent() {
  const params = useParams<{ id: string }>();
  const eventId = Array.isArray(params.id) ? params.id[0] : params.id;
  const [event, setEvent] = useState<CampusEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!eventId) {
      setError("Event ID is missing from the URL.");
      setLoading(false);
      return;
    }

    const controller = new AbortController();

    async function loadEvent() {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(
                    `${API_URL}/events/${encodeURIComponent(eventId)}`,
          {
            headers: {
              Accept: "application/json",
              ...(localStorage.getItem("campus_life_token")
                ? { Authorization: `Bearer ${localStorage.getItem("campus_life_token")}` }
                : {}),
            },
            cache: "no-store",
            signal: controller.signal,
          }
        );
        const result = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(
            response.status === 404
              ? "This event could not be found or is no longer available."
              : result?.message || "Unable to load this event. Please try again."
          );
        }

        const foundEvent = result?.event ?? result?.data ?? result;
        if (!foundEvent || typeof foundEvent !== "object" || !foundEvent.id) {
          throw new Error("The server returned event details in an unexpected format.");
        }
        setEvent(foundEvent as CampusEvent);
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Unable to load this event.");
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }

    void loadEvent();
    return () => controller.abort();
  }, [eventId]);

  const image = eventImageUrl(event?.image_path);
  const start = formatDateTime(event?.starts_at);
  const end = formatDateTime(event?.ends_at);

  return (
    <div className="min-h-screen bg-slate-50 pb-10 text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <Link href="/events" className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
            <ArrowLeft size={18} />
            <span>Back to events</span>
          </Link>
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="Campus Plus home">
            <BrandMark size={36} className="shrink-0 rounded-xl" />
            <span className="text-base font-bold tracking-tight text-[#0B1F3A]">Campus <span className="text-[#FF7900]">Plus</span></span>
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-5 sm:px-6 sm:py-7">
        {loading && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="h-40 animate-pulse bg-slate-200 sm:h-52" />
            <div className="space-y-4 p-5 sm:p-7">
              <div className="h-7 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
              <div className="h-4 w-4/5 animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        )}

        {!loading && error && (
          <div role="alert" className="rounded-2xl border border-red-200 bg-white p-8 text-center">
            <h1 className="text-xl font-bold text-[#0B1F3A]">Could not load event</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">{error}</p>
            <Link href="/events" className="mt-5 inline-flex items-center rounded-xl bg-[#0B1F3A] px-5 py-3 text-sm font-bold text-white hover:bg-[#17385F]">Back to events</Link>
          </div>
        )}

        {!loading && !error && event && (
          <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            <div className="relative h-40 bg-slate-100 sm:h-52 lg:h-60">
              {image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={image} alt={event.title} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-slate-400">
                  <ImageIcon size={38} strokeWidth={1.3} />
                  <span className="text-sm">No event image available</span>
                </div>
              )}
              {event.category && <span className="absolute left-3 top-3 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1F3A] shadow-sm">{event.category}</span>}
            </div>

            <div className="p-5 sm:p-7">
              <div className="border-b border-slate-100 pb-5">
                <p className="text-xs font-bold uppercase tracking-wider text-[#B45309]">Campus event</p>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-[#0B1F3A] sm:text-3xl">{event.title}</h1>
                <p className="mt-2 text-sm text-slate-500">
                  {event.organizer?.name ? `Organized by ${event.organizer.name}` : "Organized by the campus community"}
                </p>
              </div>

              <div className="grid gap-4 border-b border-slate-100 py-5 sm:grid-cols-2">
                {start && (
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF7900]"><CalendarDays size={20} /></span>
                    <div><h2 className="font-semibold text-[#0B1F3A]">Date</h2><p className="mt-1 text-sm leading-6 text-slate-600">{start.date}</p></div>
                  </div>
                )}
                {start && (
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF7900]"><Clock3 size={20} /></span>
                    <div>
                      <h2 className="font-semibold text-[#0B1F3A]">Time</h2>
                      <p className="mt-1 text-sm leading-6 text-slate-600">{start.time}{end ? ` – ${end.time}` : ""}</p>
                      {end && end.date !== start.date && <p className="text-sm text-slate-500">Ends {end.date}</p>}
                    </div>
                  </div>
                )}
                {(event.venue || event.campus) && (
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF7900]"><MapPin size={20} /></span>
                    <div><h2 className="font-semibold text-[#0B1F3A]">Location</h2>{event.venue && <p className="mt-1 text-sm leading-6 text-slate-600">{event.venue}</p>}{event.campus && <p className="text-sm text-slate-500">{event.campus}</p>}</div>
                  </div>
                )}
                {event.attendee_limit != null && (
                  <div className="flex items-start gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-[#FF7900]"><Users size={20} /></span>
                    <div><h2 className="font-semibold text-[#0B1F3A]">Attendance limit</h2><p className="mt-1 text-sm leading-6 text-slate-600">Up to {event.attendee_limit} attendees</p></div>
                  </div>
                )}
              </div>

              <section className="pt-5">
                <h2 className="text-lg font-bold text-[#0B1F3A]">About this event</h2>
                {event.description ? (
                  <p className="mt-3 whitespace-pre-line text-sm leading-7 text-slate-600 sm:text-base">{event.description}</p>
                ) : (
                  <p className="mt-3 text-sm text-slate-500">No event description has been added yet.</p>
                )}
              </section>

              <div className="mt-6 rounded-xl border border-orange-100 bg-orange-50 p-4 text-sm leading-6 text-slate-700">
                <div className="flex items-start gap-3"><GraduationCap size={21} className="mt-0.5 shrink-0 text-[#FF7900]" /><p>Explore the event details above. Event registration will be added in a later step.</p></div>
              </div>
              <Link href="/events" className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#0B1F3A] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#17385F]"><ArrowLeft size={17} /> Back to all events</Link>
            </div>
          </article>
        )}
      </main>
    </div>
  );
}

export default function EventDetailsPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 px-4 py-8">
          <div className="mx-auto max-w-5xl overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="h-40 animate-pulse bg-slate-200 sm:h-52" />
            <div className="space-y-4 p-5">
              <div className="h-7 w-2/3 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-full animate-pulse rounded bg-slate-100" />
            </div>
          </div>
        </div>
      }
    >
      <EventDetailsContent />
    </Suspense>
  );
}