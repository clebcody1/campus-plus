"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Star, MapPin, Phone, MessageCircle, Store, LoaderCircle,
  Pencil, Trash2, EyeOff, BadgeCheck, UserRound, Eye, Sparkles, Share2,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import { API_URL, storageUrl } from "@/lib/api";
import { SERVICE_CATEGORIES } from "@/components/ServiceForm";

type Owner = { id: number; name?: string; username?: string; is_verified?: boolean };

type Service = {
  id: number;
  name: string;
  category: string;
  description?: string | null;
  phone: string;
  whatsapp?: string | null;
  location?: string | null;
  university?: string | null;
  price_from?: string | number | null;
  image_path?: string | null;
  is_active: boolean;
  is_promoted?: boolean;
  promoted_until?: string | null;
  views?: number;
  owner?: Owner | null;
  rating: { count: number; average: number };
};

type Review = {
  id: number;
  user_id: number;
  rating: number;
  comment?: string | null;
  created_at?: string;
  reviewer?: Owner | null;
};

const categoryLabel = (id: string) =>
  SERVICE_CATEGORIES.find((c) => c.id === id)?.label ?? id;

/** How long an admin can feature a listing for, in one tap. */
const PROMOTE_OPTIONS = [
  { days: 14, label: "2 weeks free" },
  { days: 7, label: "1 week" },
  { days: 30, label: "1 month" },
];

/**
 * The campus a shared link is pointing at.
 *
 * Read off window.location rather than useSearchParams(), which in Next 15
 * forces the page behind a Suspense boundary or fails the build. The server
 * ignores it for a signed-in student, so sending it always is safe.
 */
function campusParam() {
  if (typeof window === "undefined") return "";
  return new URLSearchParams(window.location.search).get("university")?.trim() ?? "";
}

/** Appends ?university= to an API path when a shared link carried one. */
function withCampus(path: string) {
  const campus = campusParam();
  if (!campus) return path;
  return path + (path.includes("?") ? "&" : "?") + "university=" + encodeURIComponent(campus);
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          className={n <= Math.round(value) ? "fill-[#FF7900] text-[#FF7900]" : "text-slate-300"}
        />
      ))}
    </span>
  );
}

function StarPicker({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          aria-pressed={value === n}
          className="rounded p-0.5 transition hover:scale-110"
        >
          <Star
            size={28}
            className={n <= value ? "fill-[#FF7900] text-[#FF7900]" : "text-slate-300"}
          />
        </button>
      ))}
    </div>
  );
}

function naira(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 0 });
}

/**
 * wa.me needs the full international number with no symbols.
 * Nigerian students write theirs as 0803..., +234803... or 234803...
 */
function whatsappLink(raw?: string | null) {
  if (!raw) return null;

  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = "234" + digits.slice(1);
  if (digits.length < 10) return null;

  return `https://wa.me/${digits}`;
}

function formatDate(value?: string | null) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

export default function ServiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? "");

  const [service, setService] = useState<Service | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  const [reviews, setReviews] = useState<Review[]>([]);
  const [canReview, setCanReview] = useState(false);
  const [myReview, setMyReview] = useState<Review | null>(null);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [writing, setWriting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const [deleting, setDeleting] = useState(false);
  const [promoting, setPromoting] = useState(false);
  const [promoteNotice, setPromoteNotice] = useState("");
  const [shareNotice, setShareNotice] = useState("");

  /*
   | The explicit return type matters. Without it this returns a union of
   | { Authorization: string } and {}, and spreading a union into `headers`
   | gives TypeScript no single shape it can match against HeadersInit.
   */
  const authHeaders = useCallback((): Record<string, string> => {
    const token = localStorage.getItem("campus_life_token");
    return token ? { Authorization: `Bearer ${token}` } : {};
  }, []);

  const loadService = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await fetch(withCampus(`${API_URL}/services/${id}`), {
        headers: { Accept: "application/json", ...authHeaders() },
        cache: "no-store",
      });

      if (response.status === 404) {
        setNotFound(true);
        return;
      }
      if (!response.ok) throw new Error("Could not load this service.");

      const data = await response.json();
      setService(data.service ?? null);
      setIsOwner(Boolean(data.is_owner));
      setIsAdmin(Boolean(data.is_admin));
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
  }, [id, authHeaders]);

  const loadReviews = useCallback(async () => {
    try {
      const response = await fetch(withCampus(`${API_URL}/services/${id}/reviews`), {
        headers: { Accept: "application/json", ...authHeaders() },
        cache: "no-store",
      });

      if (!response.ok) return;

      const data = await response.json();
      setReviews(Array.isArray(data.reviews) ? data.reviews : []);
      setCanReview(Boolean(data.can_review));
      setMyReview(data.my_review ?? null);

      if (data.my_review) {
        setRating(data.my_review.rating ?? 0);
        setComment(data.my_review.comment ?? "");
      }
    } catch {
      // A failed review load should not take the whole page down.
    }
  }, [id, authHeaders]);

  useEffect(() => {
    if (!id) return;
    loadService();
    loadReviews();
  }, [id, loadService, loadReviews]);

  /**
   * Share this listing with the campus baked into the link.
   *
   * This is how a vendor's own customers reach the app. Without the
   * ?university= on the end, somebody with no account opens the link and
   * lands on the default campus instead of this business's one, and the
   * listing they were sent simply is not there.
   */
  async function shareListing() {
    if (typeof window === "undefined" || !service) return;

    const url = new URL(window.location.href);
    url.search = "";
    if (service.university) url.searchParams.set("university", service.university);
    const link = url.toString();

    // The native sheet on a phone, which is where this actually gets used:
    // straight into WhatsApp.
    if (navigator.share) {
      try {
        await navigator.share({ title: service.name, url: link });
        return;
      } catch {
        // Cancelling the sheet is not an error. Fall through to copying.
      }
    }

    try {
      await navigator.clipboard.writeText(link);
      setShareNotice("Link copied.");
    } catch {
      setShareNotice(link);
    }

    window.setTimeout(() => setShareNotice(""), 4000);
  }

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setReviewError("");

    if (rating < 1) {
      setReviewError("Pick a star rating first.");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/services/${id}/reviews`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({ rating, comment: comment.trim() || null }),
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not save your review.");

      setWriting(false);
      await Promise.all([loadService(), loadReviews()]);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteMyReview() {
    if (!myReview) return;
    if (!window.confirm("Delete your review?")) return;

    setSaving(true);

    try {
      const response = await fetch(`${API_URL}/service-reviews/${myReview.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", ...authHeaders() },
      });

      if (!response.ok) throw new Error("Could not delete your review.");

      setMyReview(null);
      setRating(0);
      setComment("");
      setWriting(false);
      await Promise.all([loadService(), loadReviews()]);
    } catch (err) {
      setReviewError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteService() {
    if (!window.confirm("Remove this listing? Your reviews go with it and this cannot be undone.")) {
      return;
    }

    setDeleting(true);

    try {
      const response = await fetch(`${API_URL}/services/${id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", ...authHeaders() },
      });

      if (!response.ok) throw new Error("Could not remove this listing.");

      router.push("/services");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setDeleting(false);
    }
  }

  /**
   * Admin only. days = 0 stops the promotion.
   */
  async function promote(days: number) {
    setPromoting(true);
    setPromoteNotice("");

    try {
      const response = await fetch(`${API_URL}/admin/services/${id}/promote`, {
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

      setService(data.service ?? service);
      setPromoteNotice(data.message || "Updated.");
    } catch (err) {
      setPromoteNotice(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPromoting(false);
    }
  }

  if (notFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center bg-[#F0F4F9] px-6 text-center">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#FF7900]">
          <Store size={26} />
        </span>
        <h1 className="mt-4 text-xl font-extrabold text-[#0B1F3A]">Service not found</h1>
        <p className="mt-2 max-w-sm text-sm leading-6 text-slate-600">
          This listing may have been removed, or it belongs to a different campus.
        </p>
        <Link
          href="/services"
          className="mt-6 rounded-xl bg-[#FF7900] px-5 py-3 text-sm font-bold text-white hover:opacity-90"
        >
          Browse services
        </Link>
      </main>
    );
  }

  const image = storageUrl(service?.image_path);
  const price = naira(service?.price_from);
  const wa = whatsappLink(service?.whatsapp || service?.phone);

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
        <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold text-[#0B1F3A]">
          {service?.name ?? "Service"}
        </h1>

        {service && (
          <button
            type="button"
            onClick={shareListing}
            aria-label="Share this listing"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 text-[#0B1F3A] transition hover:bg-slate-50"
          >
            <Share2 size={17} />
          </button>
        )}
      </header>

      <div className="mx-auto max-w-2xl px-4 py-5">
        {error && (
          <p role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {shareNotice && (
          <p role="status" className="mb-4 break-all rounded-xl border border-green-200 bg-green-50 p-3 text-sm font-semibold text-green-800">
            {shareNotice}
          </p>
        )}

        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-600">
            <LoaderCircle size={20} className="animate-spin text-[#FF7900]" />
            Loading...
          </div>
        ) : service ? (
          <>
            {!service.is_active && (
              <p className="mb-4 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-800">
                <EyeOff size={17} className="shrink-0" />
                This listing is paused. Only you can see it.
              </p>
            )}

            <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
              <div className="relative h-56 w-full bg-slate-100">
                {image ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={image} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-slate-300">
                    <Store size={44} />
                  </span>
                )}

                {service.is_promoted && (
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-[#0B1F3A]/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
                    <Sparkles size={12} /> Promoted
                  </span>
                )}
              </div>

              <div className="p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                    {categoryLabel(service.category)}
                  </span>
                  {price && (
                    <span className="rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-[#B45309]">
                      from {price}
                    </span>
                  )}
                </div>

                <h2 className="mt-3 text-2xl font-extrabold text-[#0B1F3A]">{service.name}</h2>

                {service.rating.count > 0 ? (
                  <div className="mt-2 flex items-center gap-2 text-sm">
                    <Stars value={service.rating.average} size={16} />
                    <span className="font-bold text-[#0B1F3A]">
                      {service.rating.average.toFixed(1)}
                    </span>
                    <span className="text-slate-500">
                      ({service.rating.count} {service.rating.count === 1 ? "review" : "reviews"})
                    </span>
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">No reviews yet</p>
                )}

                {service.location && (
                  <p className="mt-3 flex items-start gap-1.5 text-sm text-slate-600">
                    <MapPin size={15} className="mt-0.5 shrink-0" />
                    {service.location}
                  </p>
                )}

                {service.description && (
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                    {service.description}
                  </p>
                )}

                {/* Contact. Call and WhatsApp open the phone's own apps, which
                    is where these conversations actually happen. */}
                <div className="mt-5 flex flex-wrap gap-2">
                  <a
                    href={`tel:${service.phone}`}
                    className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-3 text-sm font-bold text-[#0B1F3A] transition hover:bg-slate-50"
                  >
                    <Phone size={16} /> Call
                  </a>
                  {wa && (
                    <a
                      href={wa}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#FF7900] px-4 py-3 text-sm font-bold text-white transition hover:opacity-90"
                    >
                      <MessageCircle size={16} /> WhatsApp
                    </a>
                  )}
                </div>

                {service.owner && (
                  <Link
                    href={`/users/${service.owner.id}`}
                    className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-4 text-sm text-slate-600 hover:text-[#0B1F3A]"
                  >
                    <UserRound size={15} />
                    Listed by
                    <span className="font-bold text-[#0B1F3A]">{service.owner.name}</span>
                    {service.owner.is_verified && (
                      <BadgeCheck size={15} className="text-[#FF7900]" />
                    )}
                  </Link>
                )}

                {/* The owner's own numbers. This is the figure that decides
                    whether they renew, so they see it on their own listing. */}
                {(isOwner || isAdmin) && (
                  <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-sm">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <Eye size={15} className="shrink-0" />
                      <span className="font-bold text-[#0B1F3A]">{service.views ?? 0}</span>
                      {(service.views ?? 0) === 1 ? "open" : "opens"}
                    </span>

                    {service.is_promoted && service.promoted_until && (
                      <span className="flex items-center gap-1.5 font-semibold text-[#B45309]">
                        <Sparkles size={15} className="shrink-0" />
                        Featured until {formatDate(service.promoted_until)}
                      </span>
                    )}
                  </div>
                )}

                {isOwner && (
                  <>
                    <div className="mt-4 flex gap-2 border-t border-slate-100 pt-4">
                      <Link
                        href={`/services/${service.id}/edit`}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <Pencil size={15} /> Edit
                      </Link>
                      <button
                        type="button"
                        onClick={shareListing}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <Share2 size={15} /> Share
                      </button>
                      <button
                        type="button"
                        onClick={deleteService}
                        disabled={deleting}
                        className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-300 px-4 py-2.5 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                      >
                        {deleting ? <LoaderCircle size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        Remove
                      </button>
                    </div>

                    <p className="mt-2 text-xs leading-5 text-slate-500">
                      Send that link to your customers. It opens your listing even
                      for people who have never used Campus Plus.
                    </p>
                  </>
                )}

                {/* Admin promotion controls. No payment flow: the vendor
                    transfers the money, you tap the button. */}
                {isAdmin && (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="flex items-center gap-1.5 text-sm font-bold text-[#0B1F3A]">
                      <Sparkles size={15} className="text-[#FF7900]" /> Promotion
                    </p>

                    <p className="mt-1 text-xs leading-5 text-slate-600">
                      {service.is_promoted && service.promoted_until
                        ? `Featured in the carousel until ${formatDate(service.promoted_until)}. Adding more days extends from that date.`
                        : "Not currently featured. Featuring puts this listing in the carousel at the top of the directory."}
                    </p>

                    <div className="mt-3 flex flex-wrap gap-2">
                      {PROMOTE_OPTIONS.map((option) => (
                        <button
                          key={option.days}
                          type="button"
                          onClick={() => promote(option.days)}
                          disabled={promoting}
                          className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-[#0B1F3A] transition hover:bg-white/70 disabled:opacity-60"
                        >
                          + {option.label}
                        </button>
                      ))}

                      {service.is_promoted && (
                        <button
                          type="button"
                          onClick={() => promote(0)}
                          disabled={promoting}
                          className="ml-auto rounded-xl border border-red-300 bg-white px-3 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50 disabled:opacity-60"
                        >
                          Stop featuring
                        </button>
                      )}
                    </div>

                    {promoting && (
                      <p className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        <LoaderCircle size={13} className="animate-spin" /> Updating...
                      </p>
                    )}

                    {promoteNotice && !promoting && (
                      <p role="status" className="mt-2 text-xs font-semibold text-green-700">
                        {promoteNotice}
                      </p>
                    )}
                  </div>
                )}
              </div>
            </section>

            {/* Reviews */}
            <section className="mt-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="text-lg font-extrabold text-[#0B1F3A]">Reviews</h2>
                {canReview && !writing && (
                  <button
                    type="button"
                    onClick={() => setWriting(true)}
                    className="rounded-xl bg-[#0B1F3A] px-3.5 py-2 text-sm font-bold text-white hover:opacity-90"
                  >
                    {myReview ? "Edit my review" : "Write a review"}
                  </button>
                )}
              </div>

              {writing && (
                <form
                  onSubmit={submitReview}
                  className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <span className="mb-2 block text-sm font-semibold text-[#0B1F3A]">
                    How was it?
                  </span>
                  <StarPicker value={rating} onChange={setRating} />

                  <textarea
                    rows={3}
                    maxLength={500}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="What was good, what wasn't. Keep it fair."
                    className="mt-3 w-full resize-none rounded-xl border border-slate-200 px-4 py-3 text-base text-[#0B1F3A] placeholder:text-slate-400 outline-none focus:border-[#FF7900] focus:ring-2 focus:ring-orange-100"
                  />

                  {reviewError && (
                    <p role="alert" className="mt-2 text-sm font-medium text-red-600">
                      {reviewError}
                    </p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="inline-flex items-center gap-2 rounded-xl bg-[#FF7900] px-4 py-2.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-60"
                    >
                      {saving && <LoaderCircle size={15} className="animate-spin" />}
                      {myReview ? "Update review" : "Post review"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setWriting(false)}
                      className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
                    >
                      Cancel
                    </button>
                    {myReview && (
                      <button
                        type="button"
                        onClick={deleteMyReview}
                        disabled={saving}
                        className="ml-auto rounded-xl border border-red-300 px-4 py-2.5 text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </form>
              )}

              {reviews.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center">
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-50 text-[#FF7900]">
                    <Star size={22} />
                  </span>
                  <p className="mt-3 font-bold text-[#0B1F3A]">No reviews yet</p>
                  <p className="mx-auto mt-1 max-w-xs text-sm leading-6 text-slate-600">
                    Used this service? Your review helps the next student decide.
                  </p>
                </div>
              ) : (
                <ul className="space-y-3">
                  {reviews.map((review) => (
                    <li
                      key={review.id}
                      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-center gap-2">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-800">
                          {(review.reviewer?.name || "?")
                            .trim()
                            .split(/\s+/)
                            .slice(0, 2)
                            .map((p) => p[0])
                            .join("")
                            .toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-bold text-[#0B1F3A]">
                            {review.reviewer?.name ?? "Student"}
                          </p>
                          <span className="flex items-center gap-2">
                            <Stars value={review.rating} size={12} />
                            <span className="text-xs text-slate-500">
                              {formatDate(review.created_at)}
                            </span>
                          </span>
                        </div>
                      </div>

                      {review.comment && (
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-700">
                          {review.comment}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        ) : null}
      </div>

      <BottomNav />
    </main>
  );
}