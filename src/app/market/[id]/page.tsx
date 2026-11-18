"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  MessageCircle,
  MapPin,
  Tag,
  ShieldCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Flag,
  Star,
  X,
} from "lucide-react";
import VerifiedBadge from "@/components/VerifiedBadge";
import { API_URL, API_ORIGIN } from "@/lib/api";

const focus =
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";

type AnyRecord = Record<string, unknown>;

type Product = {
  id: string | number;
  title: string;
  description: string;
  price: number | string | null;
  category: string;
  condition: string;
  campus: string;
  images: string[];
  sellerName: string;
  sellerId: string | number | null;
  sellerAvatar: string;
  sellerUniversity: string;
  sellerEmail: string;
  sellerVerified: boolean;
  sellerAdmin: boolean;
  createdAt: string;
};

type SellerRating = { count: number; average: number };

type ReportTarget = "product" | "seller";

const PRODUCT_REPORT_REASONS = [
  "Scam or fraud",
  "Prohibited or illegal item",
  "Misleading photos or description",
  "Counterfeit item",
  "Spam or duplicate listing",
  "Other",
];

const SELLER_REPORT_REASONS = [
  "Scam or fraud",
  "Harassment or abuse",
  "Fake profile",
  "Spam",
  "Other",
];

/* ---------- data helpers (unchanged behaviour) ---------- */

function isRecord(value: unknown): value is AnyRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstValue(...values: unknown[]): unknown {
  return values.find(
    (value) => value !== null && value !== undefined && String(value).trim() !== ""
  );
}

function textValue(values: unknown[], fallback = ""): string {
  const value = firstValue(...values);
  return value === undefined ? fallback : String(value);
}

function formatNaira(value: number | string | null) {
  if (value === null || value === "") return "Price unavailable";

  const amount = Number(value);

  if (!Number.isFinite(amount)) return `₦${value}`;

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 2,
  }).format(amount);
}

function getToken() {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("campus_life_token");
}

function getImageUrl(value: unknown): string {
  if (typeof value !== "string" || !value.trim()) return "";

  const path = value.trim();

  if (/^https?:\/\//i.test(path)) return path;

  const cleanPath = path.replace(/^\/+/, "");

  if (cleanPath.startsWith("data:")) return cleanPath;

  if (cleanPath.startsWith("storage/")) {
    return `${API_ORIGIN}/${cleanPath}`;
  }

  if (cleanPath.startsWith("public/")) {
    return `${API_ORIGIN}/${cleanPath.replace(/^public\//, "storage/")}`;
  }

  return `${API_ORIGIN}/storage/${cleanPath}`;
}

function getProductImages(item: AnyRecord): string[] {
  const possibleImages = firstValue(
    item.images,
    item.photos,
    item.listing_images,
    item.product_images
  );

  const images: string[] = [];

  if (Array.isArray(possibleImages)) {
    for (const image of possibleImages) {
      let value: unknown = image;

      if (isRecord(image)) {
        value = firstValue(image.url, image.image_url, image.image_path, image.path, image.src);
      }

      const url = getImageUrl(value);
      if (url && !images.includes(url)) images.push(url);
    }
  }

  const primaryImage = getImageUrl(
    firstValue(item.image_url, item.image_path, item.image, item.photo, item.thumbnail)
  );

  if (primaryImage && !images.includes(primaryImage)) {
    images.unshift(primaryImage);
  }

  return images;
}

function normalizeProduct(raw: AnyRecord, requestedId: string): Product {
  // Support listings returned directly or inside common Laravel wrappers.
  const nestedListing = firstValue(raw.listing, raw.product, raw.item);
  const item = isRecord(nestedListing) ? nestedListing : raw;

  const nestedSeller = firstValue(item.seller, item.user, item.owner, item.created_by);
  const seller = isRecord(nestedSeller) ? nestedSeller : {};

  const nestedProfile = firstValue(seller.profile, seller.user);
  const profile = isRecord(nestedProfile) ? nestedProfile : {};

  const title = textValue(
    [item.title, item.name, item.product_name, item.listing_title, item.item_name],
    "Product details"
  );

  const description = textValue(
    [item.description, item.details, item.product_description, item.about],
    "No description has been added by the seller yet."
  );

  const rawPrice = firstValue(item.price, item.amount, item.selling_price, item.price_amount);

  const rawSellerName = firstValue(
    seller.name,
    seller.full_name,
    profile.name,
    profile.full_name,
    item.seller_name,
    item.owner_name,
    item.user_name
  );

  const rawCategory = firstValue(
    item.category_name,
    isRecord(item.category) ? item.category.name : item.category,
    item.product_category,
    item.type
  );

  const rawCondition = firstValue(
    item.condition,
    item.product_condition,
    item.item_condition,
    item.quality
  );

  const rawCampus = firstValue(
    item.campus,
    item.university,
    seller.university,
    profile.university,
    item.school
  );

  const sellerId = firstValue(seller.id, profile.id, item.seller_id, item.user_id, item.owner_id);

  const sellerEmail = textValue([seller.email, profile.email, item.seller_email]);

  const sellerVerified = Boolean(seller.is_verified ?? profile.is_verified);

  const sellerAdmin = String(seller.role ?? profile.role ?? "").toLowerCase() === "admin";

  return {
    id: firstValue(item.id, item.listing_id, requestedId) as string | number,
    title,
    description,
    price: rawPrice === undefined ? null : (rawPrice as number | string),
    category: textValue([rawCategory], "Not provided"),
    condition: textValue([rawCondition], "Not provided"),
    campus: textValue([rawCampus], "LAUTECH"),
    images: getProductImages(item),
    sellerName: textValue([rawSellerName], "Campus Plus seller"),
    sellerId: (sellerId ?? null) as string | number | null,
    sellerAvatar: getImageUrl(firstValue(seller.avatar_path, profile.avatar_path)),
    sellerUniversity: textValue(
      [seller.university, profile.university, item.university],
      "LAUTECH"
    ),
    sellerEmail,
    sellerVerified,
    sellerAdmin,
    createdAt: textValue([item.created_at, item.createdAt]),
  };
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    cache: "no-store",
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const validation =
      isRecord(result) && isRecord(result.errors)
        ? Object.values(result.errors).flat().join(" ")
        : "";
    const message = isRecord(result) ? textValue([validation, result.message, result.error]) : "";

    throw new Error(message || `Request failed with status ${response.status}.`);
  }

  return result as T;
}

function unwrapProduct(result: unknown, id: string): Product {
  if (!isRecord(result)) {
    throw new Error("The server returned an invalid product response.");
  }

  // Laravel can return {data: product}, {listing: product},
  // {product: product}, or the product itself.
  const candidates = [result.listing, result.product, result.data, result.item];

  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;

    const nested = firstValue(candidate.listing, candidate.product, candidate.item);

    const item = isRecord(nested) ? nested : candidate;

    if (
      firstValue(item.id, item.listing_id, item.title, item.name, item.product_name) !== undefined
    ) {
      return normalizeProduct(item, id);
    }
  }

  return normalizeProduct(result, id);
}

/* ---------- display helpers ---------- */

// "like_new" -> "Like new"
function formatLabel(value: string) {
  const text = value.replace(/[_-]+/g, " ").trim();
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : text;
}

function formatListedDate(value: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" });
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "S";
}

/** Five stars, filled to the rating. Read-only. */
function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          strokeWidth={1.8}
          className={n <= Math.round(value) ? "text-[#FF7900]" : "text-slate-300"}
          fill={n <= Math.round(value) ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

// The seller's profile picture, or their initials if they have none.
function SellerAvatar({ name, src }: { name: string; src?: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-100 font-bold text-orange-800">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        getInitials(name)
      )}
    </div>
  );
}

// Makes whatever is inside it open that user's profile. Falls back to a plain box
// when the seller id isn't known.
function ProfileLink({
  userId,
  className,
  children,
}: {
  userId?: number | string | null;
  className?: string;
  children: React.ReactNode;
}) {
  if (!userId) return <div className={className}>{children}</div>;
  return (
    <Link href={`/users/${userId}`} className={className}>
      {children}
    </Link>
  );
}

/* ---------- page ---------- */

function MarketplaceProductContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const productId = String(params.id ?? "");

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeImage, setActiveImage] = useState(0);
  const [failedImages, setFailedImages] = useState<Record<string, boolean>>({});
  const [sendingMessage, setSendingMessage] = useState(false);
  const [notice, setNotice] = useState("");
  const touchStartX = useRef<number | null>(null);

  // How other students have rated this seller.
  const [sellerRating, setSellerRating] = useState<SellerRating | null>(null);

  // Reporting
  const [myId, setMyId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [reportReason, setReportReason] = useState("");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportDone, setReportDone] = useState("");

  const loadProduct = useCallback(async () => {
    if (!productId) {
      setError("The product ID is missing from the URL.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const result = await apiRequest<unknown>(`/marketplace/${encodeURIComponent(productId)}`);

      setProduct(unwrapProduct(result, productId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this product.");
    } finally {
      setLoading(false);
    }
  }, [productId]);

  useEffect(() => {
    void loadProduct();
  }, [loadProduct]);

  /* The seller's rating. Fetched once the listing tells us who the seller is,
     and allowed to fail quietly — a missing rating should never stop someone
     seeing the item. */
  useEffect(() => {
    const sellerId = product?.sellerId;
    if (!sellerId) return;

    let cancelled = false;

    apiRequest<{ summary?: SellerRating }>(`/users/${encodeURIComponent(String(sellerId))}/reviews`)
      .then((result) => {
        if (!cancelled && result.summary) setSellerRating(result.summary);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [product?.sellerId]);

  // Who is signed in, so you aren't offered a way to report your own listing.
  useEffect(() => {
    if (!getToken()) return;

    try {
      const raw = window.localStorage.getItem("campus_life_user");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.id !== undefined) setMyId(String(parsed.id));
    } catch {
      // Ignore a corrupt cached user.
    }

    apiRequest<{ user?: { id?: number }; id?: number }>("/user")
      .then((result) => {
        const id = result.user?.id ?? result.id;
        if (id !== undefined) setMyId(String(id));
      })
      .catch(() => {});
  }, []);

  // Dismiss the "report sent" message after a few seconds.
  useEffect(() => {
    if (!reportDone) return;
    const timeout = window.setTimeout(() => setReportDone(""), 6000);
    return () => window.clearTimeout(timeout);
  }, [reportDone]);

  async function messageSeller() {
    if (!product) return;

    if (!getToken()) {
      router.push("/login");
      return;
    }

    try {
      setSendingMessage(true);
      setNotice("");

      const result = await apiRequest<unknown>(
        `/marketplace/${encodeURIComponent(String(product.id))}/conversation`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      if (!isRecord(result)) {
        throw new Error("The server returned an invalid conversation.");
      }

      const conversationWrapper = firstValue(result.conversation, result.data);

      const conversation = isRecord(conversationWrapper) ? conversationWrapper : result;

      const conversationId = firstValue(conversation.id, conversation.conversation_id);

      if (conversationId === undefined) {
        throw new Error("The conversation was created, but the server did not return its ID.");
      }

      // The Market page owns the chat popup, so open it there.
      router.push(`/market?chat=${encodeURIComponent(String(product.id))}`);
    } catch (err) {
      setNotice(
        err instanceof Error ? err.message : "Could not start a conversation with the seller."
      );
    } finally {
      setSendingMessage(false);
    }
  }

  function openReport(target: ReportTarget) {
    if (!getToken()) {
      router.push("/login");
      return;
    }
    setReportTarget(target);
    setReportReason("");
    setReportDetails("");
    setReportError("");
  }

  function closeReport() {
    if (reportSubmitting) return;
    setReportTarget(null);
  }

  async function submitReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!product || !reportTarget || reportSubmitting) return;

    if (!reportReason) {
      setReportError("Please choose a reason.");
      return;
    }

    try {
      setReportSubmitting(true);
      setReportError("");

      const payload =
        reportTarget === "product"
          ? { type: "product", listing_id: Number(product.id) }
          : { type: "seller", reported_user_id: Number(product.sellerId) };

      await apiRequest("/marketplace/reports", {
        method: "POST",
        body: JSON.stringify({
          ...payload,
          reason: reportReason,
          details: reportDetails.trim() || null,
        }),
      });

      setReportTarget(null);
      setReportDone(
        reportTarget === "product"
          ? "Thanks. Your report on this listing has been sent for review."
          : "Thanks. Your report on this seller has been sent for review."
      );
    } catch (err) {
      setReportError(err instanceof Error ? err.message : "Could not send your report.");
    } finally {
      setReportSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F7F8FA] px-5">
        <div className="text-center" role="status">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-slate-200 border-t-[#FF7900]" />
          <p className="font-medium text-[#0B1F3A]">Loading product details...</p>
        </div>
      </main>
    );
  }

  if (error || !product) {
    return (
      <main className="min-h-screen bg-[#F7F8FA] px-4 py-12">
        <div className="mx-auto max-w-xl rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-bold text-[#0B1F3A]">Could not load product</h1>
          <p className="mt-3 break-words text-sm text-slate-600">
            {error || "This product could not be found."}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => void loadProduct()}
              className={`rounded-xl bg-[#0B1F3A] px-5 py-3 text-sm font-semibold text-white ${focus}`}
            >
              Try again
            </button>
            <Link
              href="/market"
              className={`rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-[#0B1F3A] ${focus}`}
            >
              Back to marketplace
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const images = product.images;
  const currentImage = images[activeImage] ?? "";
  const showImage = Boolean(currentImage) && !failedImages[currentImage];
  const listed = formatListedDate(product.createdAt);
  const isOwnListing =
    myId !== null && product.sellerId !== null && String(product.sellerId) === myId;
  const reasons = reportTarget === "seller" ? SELLER_REPORT_REASONS : PRODUCT_REPORT_REASONS;

  const messageButton = (
    <button
      type="button"
      onClick={() => void messageSeller()}
      disabled={sendingMessage}
      className={`flex items-center justify-center gap-2 rounded-xl bg-[#FF7900] px-5 py-3.5 font-bold text-[#0B1F3A] transition hover:bg-[#FF8F26] disabled:cursor-not-allowed disabled:opacity-60 ${focus}`}
    >
      <MessageCircle size={19} />
      {sendingMessage ? "Opening..." : "Message seller"}
    </button>
  );

  return (
    <main className="min-h-screen overflow-x-clip bg-[#F7F8FA] pb-28 text-[#0B1F3A] lg:pb-12">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 pt-[env(safe-area-inset-top)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
          <button
            type="button"
            onClick={() => router.back()}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 transition hover:bg-slate-50 ${focus}`}
            aria-label="Go back"
          >
            <ArrowLeft size={20} />
          </button>

          <Link href="/market" className={`truncate rounded-lg text-lg font-extrabold tracking-tight ${focus}`}>
            Campus <span className="text-[#FF7900]">Plus</span>
          </Link>

          <span className="ml-auto hidden shrink-0 text-sm font-medium text-slate-600 sm:block">Marketplace</span>

          {/* Quick access to reporting from the top of the page (not on your own listing) */}
          {!isOwnListing && (
            <button
              type="button"
              onClick={() => openReport("product")}
              aria-label="Report this listing"
              className={`ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700 sm:ml-0 ${focus}`}
            >
              <Flag size={15} /> Report
            </button>
          )}
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        {reportDone && (
          <p
            role="status"
            className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800"
          >
            {reportDone}
          </p>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:items-start lg:gap-8">
          {/* Product images */}
          <section aria-label="Product photos" className="min-w-0 lg:sticky lg:top-24">
            <div
              onTouchStart={(event) => {
                touchStartX.current = event.touches[0].clientX;
              }}
              onTouchEnd={(event) => {
                const start = touchStartX.current;
                touchStartX.current = null;
                if (start === null || images.length < 2) return;

                const distance = event.changedTouches[0].clientX - start;
                if (Math.abs(distance) < 40) return;

                // Swipe left = next photo, swipe right = previous photo.
                setActiveImage((current) =>
                  distance < 0
                    ? current === images.length - 1 ? 0 : current + 1
                    : current === 0 ? images.length - 1 : current - 1
                );
              }}
              className="relative flex aspect-[4/3] w-full touch-pan-y items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-100 lg:max-h-[600px]"
            >
              {showImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={currentImage}
                  alt={product.title}
                  className="h-full w-full object-contain"
                  onError={() => setFailedImages((current) => ({ ...current, [currentImage]: true }))}
                />
              ) : (
                <div className="flex flex-col items-center gap-3 px-6 text-center text-slate-500">
                  <Tag size={48} strokeWidth={1.3} />
                  <p className="text-sm">No product photo available</p>
                </div>
              )}

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    aria-label="Previous photo"
                    onClick={() =>
                      setActiveImage((current) => (current === 0 ? images.length - 1 : current - 1))
                    }
                    className={`absolute left-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow transition hover:bg-white ${focus}`}
                  >
                    <ChevronLeft size={22} />
                  </button>

                  <button
                    type="button"
                    aria-label="Next photo"
                    onClick={() =>
                      setActiveImage((current) => (current === images.length - 1 ? 0 : current + 1))
                    }
                    className={`absolute right-3 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/95 shadow transition hover:bg-white ${focus}`}
                  >
                    <ChevronRight size={22} />
                  </button>

                  <span className="absolute bottom-3 right-3 rounded-full bg-[#0B1F3A]/85 px-3 py-1 text-xs font-medium text-white">
                    {activeImage + 1} / {images.length}
                  </span>
                </>
              )}
            </div>

            {images.length > 1 && (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {images.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    onClick={() => setActiveImage(index)}
                    aria-label={`View photo ${index + 1}`}
                    aria-current={activeImage === index}
                    className={`h-16 w-16 shrink-0 overflow-hidden rounded-xl border-2 bg-slate-100 sm:h-20 sm:w-20 ${focus} ${
                      activeImage === index ? "border-[#FF7900]" : "border-slate-200"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={image} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Product information */}
          <section aria-label="Product information" className="min-w-0 space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <span className="inline-flex max-w-full rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-[#C45B00]">
                <span className="truncate">{formatLabel(product.category)}</span>
              </span>

              <h1 className="mt-3 break-words text-2xl font-extrabold leading-tight sm:text-3xl">
                {product.title}
              </h1>

              <p className="mt-3 break-words text-2xl font-extrabold text-[#C45B00] sm:text-3xl">
                {formatNaira(product.price)}
              </p>

              <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-slate-100 pt-5 sm:grid-cols-2">
                {[
                  { icon: ShieldCheck, label: "Condition", value: formatLabel(product.condition) },
                  { icon: MapPin, label: "Campus", value: product.campus },
                  ...(listed ? [{ icon: CalendarDays, label: "Listed", value: listed }] : []),
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="flex min-w-0 items-center gap-3 rounded-xl bg-slate-50 p-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-[#FF7900] shadow-sm">
                      <Icon size={18} />
                    </span>
                    <div className="min-w-0">
                      <dt className="text-xs text-slate-500">{label}</dt>
                      <dd className="truncate text-sm font-semibold">{value}</dd>
                    </div>
                  </div>
                ))}
              </dl>

              <div className="mt-6">
                <h2 className="text-base font-bold">Description</h2>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-slate-600">
                  {product.description}
                </p>
              </div>

              {notice && (
                <div
                  role="alert"
                  className="mt-5 break-words rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
                >
                  {notice}
                </div>
              )}

              {/* Desktop button (mobile uses the bar at the bottom of the screen) */}
              <div className="mt-6 hidden lg:block [&>button]:w-full">{messageButton}</div>

              <p className="mt-3 text-center text-xs leading-5 text-slate-500">
                Contact the seller to ask questions and arrange a safe exchange on campus.
              </p>
            </div>

            {/* Seller card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5">
              <h2 className="font-bold">Seller</h2>

              <ProfileLink userId={product.sellerId} className="mt-4 flex items-center gap-3 rounded-xl transition hover:opacity-90">
                <SellerAvatar name={product.sellerName} src={product.sellerAvatar} />

                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 break-words font-bold">
                    {product.sellerName}
                    {product.sellerVerified && <VerifiedBadge className="h-4 w-4" admin={product.sellerAdmin} />}
                  </p>
                  <p className="mt-0.5 break-words text-sm text-slate-600">{product.sellerUniversity}</p>
                </div>
              </ProfileLink>

              {/* What other students thought of dealing with them. This is the
                  single most useful thing on the page for a nervous buyer, so
                  it sits directly under the name rather than further down. */}
              {sellerRating && (
                <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {sellerRating.count > 0 ? (
                    <>
                      <Stars value={sellerRating.average} />
                      <span className="text-sm font-bold text-[#B45309]">
                        {sellerRating.average.toFixed(1)}
                      </span>
                      <ProfileLink
                        userId={product.sellerId}
                        className="text-xs font-semibold text-slate-600 underline"
                      >
                        {sellerRating.count} {sellerRating.count === 1 ? "review" : "reviews"}
                      </ProfileLink>
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-slate-500">
                      No reviews yet this seller hasn&apos;t been rated.
                    </span>
                  )}
                </div>
              )}

              <p className="mt-4 rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
                Keep communication on Campus Plus and confirm the product before making payment.
              </p>

              {/* Report: not shown on your own listing */}
              {!isOwnListing && (
                <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => openReport("product")}
                    className={`inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-slate-600 transition hover:text-red-700 ${focus}`}
                  >
                    <Flag size={15} /> Report this listing
                  </button>
                  {product.sellerId && (
                    <button
                      type="button"
                      onClick={() => openReport("seller")}
                      className={`inline-flex items-center gap-1.5 rounded-lg text-sm font-semibold text-slate-600 transition hover:text-red-700 ${focus}`}
                    >
                      <Flag size={15} /> Report this seller
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* Mobile action bar */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(11,31,58,0.06)] lg:hidden">
        <div className="mx-auto flex max-w-lg items-center gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-xs text-slate-500">Price</p>
            <p className="truncate text-lg font-extrabold text-[#C45B00]">{formatNaira(product.price)}</p>
          </div>
          <div className="shrink-0">{messageButton}</div>
        </div>
      </div>

      {/* Report modal */}
      {reportTarget && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeReport();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-title"
            className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
          >
            <header className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 id="report-title" className="font-extrabold text-[#0B1F3A]">
                  {reportTarget === "product" ? "Report this listing" : "Report this seller"}
                </h2>
                <p className="mt-1 text-sm text-slate-500">
                  Tell us what&apos;s wrong. Our team will review it.
                </p>
              </div>
              <button
                type="button"
                aria-label="Close report form"
                onClick={closeReport}
                disabled={reportSubmitting}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </header>

            <p className="mb-4 line-clamp-2 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              {reportTarget === "product" ? product.title : product.sellerName}
            </p>

            <form onSubmit={submitReport} className="space-y-4">
              <div>
                <label htmlFor="report-reason" className="mb-1 block text-sm font-semibold text-slate-700">
                  Reason
                </label>
                <select
                  id="report-reason"
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 sm:text-sm"
                >
                  <option value="">Choose a reason...</option>
                  {reasons.map((reason) => (
                    <option key={reason} value={reason}>
                      {reason}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="report-details" className="mb-1 block text-sm font-semibold text-slate-700">
                  Additional details (optional)
                </label>
                <textarea
                  id="report-details"
                  value={reportDetails}
                  onChange={(event) => setReportDetails(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Add anything that helps our team review this report..."
                  className="w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 sm:text-sm"
                />
              </div>

              {reportError && (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">
                  {reportError}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closeReport}
                  disabled={reportSubmitting}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportSubmitting}
                  className="rounded-full bg-[#FF7900] px-5 py-2 text-sm font-bold text-[#0B1F3A] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {reportSubmitting ? "Sending..." : "Submit report"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  );
}

export default function MarketplaceProductPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F7F8FA]">
          <p className="font-medium text-[#0B1F3A]">Loading product details...</p>
        </main>
      }
    >
      <MarketplaceProductContent />
    </Suspense>
  );
}