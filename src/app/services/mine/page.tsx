"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Store, Plus, LoaderCircle, Eye, Star, Sparkles, EyeOff, Pencil,
  MessageCircle,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { API_URL, storageUrl } from "@/lib/api";
import { SERVICE_CATEGORIES } from "@/components/ServiceForm";

type Service = {
  id: number;
  name: string;
  category: string;
  location?: string | null;
  price_from?: string | number | null;
  image_path?: string | null;
  is_active: boolean;
  is_promoted?: boolean;
  promoted_until?: string | null;
  free_feature_used?: boolean;
  views?: number;
  rating: { count: number; average: number };
};

const categoryLabel = (id: string) =>
  SERVICE_CATEGORIES.find((c) => c.id === id)?.label ?? id;

/**
 * Where "Feature my business" requests land. Your WhatsApp number in full
 * international form, no symbols or spaces.
 */
const ADMIN_WHATSAPP = "2347062883213";

/**
 * What vendors are offered once their free week is gone. These are prices,
 * not switches: tapping one opens WhatsApp so they can pay. An admin then
 * activates it, because the switch has to live with the money.
 */
const FEATURE_PLANS = [
  { days: 7, label: "1 week", price: "₦1,500", note: "" },
  { days: 30, label: "1 month", price: "₦5,000", note: "Best value" },
];

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

export default function MyServicesPage() {
  const router = useRouter();

  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Which listing's free week is being switched on, and what the server said.
  const [claimingId, setClaimingId] = useState<number | null>(null);
  const [notice, setNotice] = useState<{ id: number; text: string } | null>(null);

  const authHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem("campus_life_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const load = useCallback(async () => {
    const token = localStorage.getItem("campus_life_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/services/mine`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) throw new Error("Could not load your services.");

      const data = await response.json();
      setServices(Array.isArray(data.services) ? data.services : []);
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Couldn't reach the server. Please check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  /** The listing's one free week, switched on by its owner. */
  async function claimFreeWeek(serviceId: number) {
    setClaimingId(serviceId);
    setNotice(null);

    try {
      const response = await fetch(`${API_URL}/services/${serviceId}/claim-feature`, {
        method: "POST",
        headers: { Accept: "application/json", ...authHeaders() },
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not start your free week.");

      // Swap in the updated listing rather than reloading the whole page, so
      // the vendor sees the change on the row they just tapped.
      setServices((current) =>
        current.map((item) => (item.id === serviceId ? { ...item, ...data.service } : item))
      );
      setNotice({ id: serviceId, text: data.message || "You are now featured." });
    } catch (err) {
      setNotice({
        id: serviceId,
        text: err instanceof Error ? err.message : "Something went wrong.",
      });
    } finally {
      setClaimingId(null);
    }
  }

  const totalViews = services.reduce((sum, s) => sum + (s.views ?? 0), 0);

  return (
    <main className="min-h-screen bg-[#F0F4F9] pb-28">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <Link
          href="/services"
          aria-label="Back to services"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-[#0B1F3A] transition hover:bg-slate-50"
        >
          <ArrowLeft size={18} />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-lg font-extrabold text-[#0B1F3A]">My services</h1>
          <p className="truncate text-xs text-slate-500">
            {loading ? "Loading..." : `${services.length} listed · ${totalViews} total opens`}
          </p>
        </div>
        <Link
          href="/services/new"
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#FF7900] px-3 py-2 text-sm font-bold text-white transition hover:opacity-90"
        >
          <Plus size={16} /> New
        </Link>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5">
        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {/* How featuring works. Explained once at the top rather than
            repeated on every card, so the rows stay scannable. */}
        {!loading && services.length > 0 && (
          <section className="mb-5 rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <p className="flex items-center gap-1.5 text-sm font-bold text-[#0B1F3A]">
              <Sparkles size={15} className="text-[#FF7900]" /> How featuring works
            </p>
            <ol className="mt-2 space-y-1.5 text-xs leading-5 text-slate-700">
              <li>
                <span className="font-bold text-[#0B1F3A]">1.</span> Featured businesses show
                at the top of Services and in the home feed, where every student sees them.
              </li>
              <li>
                <span className="font-bold text-[#0B1F3A]">2.</span> Each listing gets{" "}
                <span className="font-bold">one free week</span>. Tap the button on it to start.
              </li>
              <li>
                <span className="font-bold text-[#0B1F3A]">3.</span> After that it is ₦1,500 a
                week or ₦5,000 a month. Message us on WhatsApp to keep your spot.
              </li>
            </ol>
            <p className="mt-2 text-xs text-slate-600">
              Watch the <span className="font-bold">opens</span> count on each listing. That is
              how many students opened it, and it tells you whether featuring is working for you.
            </p>
          </section>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-600">
            <LoaderCircle size={20} className="animate-spin text-[#FF7900]" />
            Loading your listings...
          </div>
        ) : services.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#FF7900]">
              <Store size={26} />
            </span>
            <h2 className="mt-4 text-lg font-bold text-[#0B1F3A]">You have no listings yet</h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
              If you cut hair, sew, cook, print, do nails or fix phones, list it. Students
              searching for what you do will find you.
            </p>
            <Link
              href="/services/new"
              className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[#FF7900] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90"
            >
              <Plus size={16} /> List your business
            </Link>
          </div>
        ) : (
          <ul className="space-y-3">
            {services.map((service) => {
              const image = storageUrl(service.image_path);
              const claiming = claimingId === service.id;
              const rowNotice = notice?.id === service.id ? notice.text : "";

              return (
                <li
                  key={service.id}
                  className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="flex gap-3">
                    <Link
                      href={`/services/${service.id}`}
                      className="h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-slate-100"
                    >
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
                          <Store size={22} />
                        </span>
                      )}
                    </Link>

                    <div className="min-w-0 flex-1">
                      <Link href={`/services/${service.id}`} className="block">
                        <h2 className="truncate font-bold text-[#0B1F3A]">{service.name}</h2>
                        <p className="truncate text-xs text-slate-500">
                          {categoryLabel(service.category)}
                          {service.location ? ` · ${service.location}` : ""}
                        </p>
                      </Link>

                      {/* Status at a glance: live, paused, featured. This is
                          the page a vendor opens to check nothing is wrong. */}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {service.is_active ? (
                          <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-bold text-green-800 ring-1 ring-inset ring-green-200">
                            Live
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-800 ring-1 ring-inset ring-amber-200">
                            <EyeOff size={10} /> Paused
                          </span>
                        )}

                        {service.is_promoted && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#0B1F3A] px-2 py-0.5 text-[11px] font-bold text-white">
                            <Sparkles size={10} /> Featured
                            {service.promoted_until ? ` to ${formatDate(service.promoted_until)}` : ""}
                          </span>
                        )}
                      </div>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600">
                        <span className="flex items-center gap-1">
                          <Eye size={12} className="shrink-0" />
                          <span className="font-bold text-[#0B1F3A]">{service.views ?? 0}</span>
                          {(service.views ?? 0) === 1 ? "open" : "opens"}
                        </span>

                        <span className="flex items-center gap-1">
                          <Star
                            size={12}
                            className={
                              service.rating.count > 0
                                ? "fill-[#FF7900] text-[#FF7900]"
                                : "text-slate-300"
                            }
                          />
                          {service.rating.count > 0 ? (
                            <>
                              <span className="font-bold text-[#0B1F3A]">
                                {service.rating.average.toFixed(1)}
                              </span>
                              <span>({service.rating.count})</span>
                            </>
                          ) : (
                            <span className="text-slate-400">No reviews</span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Featuring. The free week first, prices once it is gone. */}
                  <div className="mt-3 rounded-xl border border-orange-200 bg-orange-50/70 p-3">
                    {!service.free_feature_used ? (
                      <>
                        <button
                          type="button"
                          onClick={() => claimFreeWeek(service.id)}
                          disabled={claiming}
                          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF7900] px-4 py-3 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60"
                        >
                          {claiming ? (
                            <LoaderCircle size={15} className="animate-spin" />
                          ) : (
                            <Sparkles size={15} />
                          )}
                          {claiming ? "Starting..." : "Feature free for 1 week"}
                        </button>
                        <p className="mt-1.5 text-center text-[11px] text-slate-500">
                          One free week per listing. No payment needed.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-xs font-bold text-[#0B1F3A]">
                          {service.is_promoted
                            ? "Extend your feature"
                            : "Feature this listing again"}
                        </p>

                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                          {FEATURE_PLANS.map((plan) => (
                            <a
                              key={plan.days}
                              href={`https://wa.me/${ADMIN_WHATSAPP}?text=${encodeURIComponent(
                                `Hi, I want to feature my business "${service.name}" on Campus Plus for ${plan.label} (${plan.price}).`
                              )}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-xl border border-orange-200 bg-white p-2.5 text-center transition hover:border-[#FF7900] hover:shadow-sm"
                            >
                              <span className="block text-xs font-bold text-[#0B1F3A]">
                                {plan.label}
                              </span>
                              <span className="mt-0.5 block text-sm font-extrabold text-[#B45309]">
                                {plan.price}
                              </span>
                              {plan.note && (
                                <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-slate-400">
                                  {plan.note}
                                </span>
                              )}
                            </a>
                          ))}
                        </div>

                        <p className="mt-2 flex items-center justify-center gap-1.5 text-[11px] font-semibold text-slate-600">
                          <MessageCircle size={12} className="shrink-0" />
                          Tap a plan to message us on WhatsApp
                        </p>
                      </>
                    )}

                    {rowNotice && !claiming && (
                      <p role="status" className="mt-2 text-xs font-semibold text-green-700">
                        {rowNotice}
                      </p>
                    )}
                  </div>

                  <div className="mt-3 flex gap-2 border-t border-slate-100 pt-3">
                    <Link
                      href={`/services/${service.id}`}
                      className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-center text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      View
                    </Link>
                    <Link
                      href={`/services/${service.id}/edit`}
                      className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[#0B1F3A] px-3 py-2 text-sm font-bold text-white transition hover:opacity-90"
                    >
                      <Pencil size={14} /> Edit
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <BottomNav />
    </main>
  );
}