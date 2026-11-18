"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Flag,
  LoaderCircle,
  RefreshCw,
  Trash2,
  UserX,
  X,
} from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "https://api.campusplus.com.ng/api";

type ReportedUser = {
  id?: number;
  name?: string;
  email?: string;
  university?: string;
  role?: string;
};

type MarketReport = {
  id: number;
  type: "product" | "seller" | string;
  reason: string;
  details?: string | null;
  status: string;
  created_at?: string;
  listing_id?: number | null;
  reported_user_id?: number | null;
  reporter?: { name?: string; email?: string } | null;
  listing?: {
    id: number;
    title?: string;
    price?: number | string | null;
    images?: string[] | null;
    status?: string;
  } | null;
  reported_user?: ReportedUser | null;
};

type Props = {
  active: boolean;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
  onPendingChange?: (count: number) => void;
};

const STATUS_FILTERS = [
  { value: "pending", label: "Pending" },
  { value: "reviewed", label: "Reviewed" },
  { value: "action_taken", label: "Action taken" },
  { value: "dismissed", label: "Dismissed" },
  { value: "all", label: "All" },
];

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  reviewed: "Reviewed",
  dismissed: "Dismissed",
  action_taken: "Action taken",
};

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";

function authHeaders(json = false): HeadersInit {
  const token = typeof window !== "undefined" ? localStorage.getItem("campus_life_token") : null;
  return {
    Accept: "application/json",
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function imageUrl(path?: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return `${API_URL.replace(/\/api\/?$/, "")}/storage/${path.replace(/^\/+/, "")}`;
}

function formatNaira(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "";
  const amount = Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-NG", { style: "currency", currency: "NGN", maximumFractionDigits: 0 }).format(amount)
    : `₦${value}`;
}

function formatDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusTone(status: string) {
  if (status === "pending") return "bg-orange-50 text-[#B45309] ring-orange-200";
  if (status === "reviewed") return "bg-green-50 text-green-800 ring-green-200";
  if (status === "action_taken") return "bg-red-50 text-red-700 ring-red-200";
  return "bg-slate-100 text-slate-700 ring-slate-200";
}

function ActionButton({
  tone = "secondary",
  className = "",
  ...props
}: React.ComponentProps<"button"> & { tone?: "primary" | "secondary" | "danger" }) {
  const tones = {
    primary: "bg-[#FF7900] text-[#0B1F3A] hover:bg-[#FF8F26]",
    secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
    danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  };
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${focus} ${tones[tone]} ${className}`}
    />
  );
}

export default function MarketplaceReportsPanel({ active, onError, onNotice, onPendingChange }: Props) {
  const [reports, setReports] = useState<MarketReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState("pending");
  const [busy, setBusy] = useState<string | null>(null);

  function problem(status: number, fallback: string) {
    if (status === 403) return "Your account does not have admin permission.";
    if (status === 401) return "Your session has expired. Please log in again.";
    return fallback;
  }

  async function load(pageNumber = 1) {
    setLoading(true);
    try {
      const filter = statusFilter === "all" ? "" : `&status=${encodeURIComponent(statusFilter)}`;
      const response = await fetch(`${API_URL}/admin/marketplace/reports?page=${pageNumber}${filter}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!response.ok) throw new Error(problem(response.status, "Could not load marketplace reports."));
      const data = await response.json();
      setReports(Array.isArray(data) ? data : data.data ?? []);
      setPage(data.current_page ?? pageNumber);
      setLastPage(data.last_page ?? 1);
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not load marketplace reports.");
    } finally {
      setLoading(false);
    }
  }

  // The number shown on the tab badge.
  async function loadPendingCount() {
    try {
      const response = await fetch(`${API_URL}/admin/marketplace/reports?status=pending`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!response.ok) return;
      const data = await response.json();
      onPendingChange?.(Number(data.total ?? (data.data ?? []).length ?? 0));
    } catch {
      // The badge is optional.
    }
  }

  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    void load(1);
  }, [statusFilter]);

  useEffect(() => {
    void loadPendingCount();
  }, []);

  useEffect(() => {
    if (active) {
      void load(page);
      void loadPendingCount();
    }
  }, [active]);
  /* eslint-enable react-hooks/exhaustive-deps */

  async function afterChange(message: string) {
    onNotice(message);
    await Promise.all([load(page), loadPendingCount()]);
  }

  async function setStatus(report: MarketReport, status: "reviewed" | "dismissed" | "action_taken") {
    setBusy(`${report.id}:${status}`);
    try {
      const response = await fetch(`${API_URL}/admin/marketplace/reports/${report.id}/status`, {
        method: "PATCH",
        headers: authHeaders(true),
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || problem(response.status, "Could not update this report."));
      await afterChange(
        status === "reviewed"
          ? "Report marked as reviewed."
          : status === "dismissed"
            ? "Report dismissed."
            : "Listing hidden from the marketplace."
      );
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not update this report.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteListing(report: MarketReport) {
    const id = report.listing?.id ?? report.listing_id;
    if (!id) return;

    const confirmed = window.confirm(
      `Permanently delete the listing "${report.listing?.title ?? `#${id}`}"? Its photos will be removed. This cannot be undone.`
    );
    if (!confirmed) return;

    setBusy(`${report.id}:listing`);
    try {
      const response = await fetch(`${API_URL}/admin/marketplace/listings/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || problem(response.status, "Could not delete this listing."));
      await afterChange("Listing deleted.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not delete this listing.");
    } finally {
      setBusy(null);
    }
  }

  async function deleteSeller(report: MarketReport) {
    const id = report.reported_user?.id ?? report.reported_user_id;
    if (!id) return;

    const name = report.reported_user?.name ?? `user #${id}`;
    const confirmed = window.confirm(
      `Permanently delete ${name}'s account? Their listings and photos will be removed and they will be signed out everywhere. This cannot be undone.`
    );
    if (!confirmed) return;

    setBusy(`${report.id}:seller`);
    try {
      const response = await fetch(`${API_URL}/admin/users/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || problem(response.status, "Could not delete this account."));
      await afterChange("Seller account deleted.");
    } catch (error) {
      onError(error instanceof Error ? error.message : "Could not delete this account.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          Show
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-[#0B1F3A] outline-none focus:border-[#FF7900]"
          >
            {STATUS_FILTERS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <ActionButton
          onClick={() => {
            void load(page);
            void loadPendingCount();
          }}
          disabled={loading}
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Refresh
        </ActionButton>
      </div>

      {loading && reports.length === 0 ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-600">
          <LoaderCircle size={20} className="animate-spin text-[#FF7900]" /> Loading reports...
        </div>
      ) : reports.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#FF7900]">
            <Flag size={26} />
          </span>
          <h2 className="mt-4 text-lg font-bold">No reports here</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
            {statusFilter === "pending"
              ? "Nothing is waiting for review. New reports from students will appear here."
              : "No reports match this filter."}
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {reports.map((report) => {
            const pending = report.status === "pending";
            const listing = report.listing;
            const seller = report.reported_user;
            const cover = imageUrl(listing?.images?.[0]);
            const sellerId = seller?.id ?? report.reported_user_id;
            const canDeleteSeller = Boolean(sellerId) && seller?.role !== "admin";
            const isBusy = busy?.startsWith(`${report.id}:`) ?? false;

            return (
              <li key={report.id}>
                <article
                  className={`rounded-2xl border border-l-4 border-slate-200 bg-white p-5 shadow-sm ${
                    pending ? "border-l-[#FF7900]" : "border-l-slate-200"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-bold">{report.reason}</h2>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700 ring-1 ring-inset ring-slate-200">
                      {report.type === "product" ? "Listing report" : "Seller report"}
                    </span>
                    <span className={`rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${statusTone(report.status)}`}>
                      {STATUS_LABELS[report.status] ?? report.status}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-600">
                    Report #{report.id} · by {report.reporter?.name ?? "Unknown student"}
                    {report.created_at ? ` · ${formatDate(report.created_at)}` : ""}
                  </p>

                  {report.details && (
                    <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700">{report.details}</p>
                  )}

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    {/* Reported listing */}
                    {(report.type === "product" || listing) && (
                      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                        <p className="text-xs font-bold text-slate-500">Reported listing</p>
                        {listing ? (
                          <div className="mt-2 flex gap-3">
                            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-200">
                              {cover ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={cover} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <span className="text-xs text-slate-500">No photo</span>
                              )}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-bold">{listing.title ?? `Listing #${listing.id}`}</p>
                              <p className="text-sm font-semibold text-[#C45B00]">{formatNaira(listing.price)}</p>
                              <p className="text-xs text-slate-500">
                                Status: {listing.status ?? "active"} ·{" "}
                                <Link href={`/market/${listing.id}`} target="_blank" className="font-semibold text-[#B45309] hover:underline">
                                  View
                                </Link>
                              </p>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-2 text-sm text-slate-600">This listing is no longer available.</p>
                        )}
                      </div>
                    )}

                    {/* Reported seller */}
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-bold text-slate-500">Seller</p>
                      {seller || sellerId ? (
                        <div className="mt-2">
                          <p className="font-bold">{seller?.name ?? `User #${sellerId}`}</p>
                          {seller?.email && <p className="break-all text-sm text-slate-600">{seller.email}</p>}
                          {seller?.university && <p className="text-sm text-slate-600">{seller.university}</p>}
                          <p className="mt-1 text-xs text-slate-500">
                            Role: {seller?.role ?? "student"}
                            {sellerId && (
                              <>
                                {" · "}
                                <Link href={`/users/${sellerId}`} target="_blank" className="font-semibold text-[#B45309] hover:underline">
                                  View profile
                                </Link>
                              </>
                            )}
                          </p>
                        </div>
                      ) : (
                        <p className="mt-2 text-sm text-slate-600">This account no longer exists.</p>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    {pending && (
                      <>
                        <ActionButton tone="primary" onClick={() => setStatus(report, "reviewed")} disabled={isBusy}>
                          {busy === `${report.id}:reviewed` ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                          Mark reviewed
                        </ActionButton>
                        <ActionButton onClick={() => setStatus(report, "dismissed")} disabled={isBusy}>
                          <X size={16} /> Dismiss
                        </ActionButton>
                      </>
                    )}

                    {listing && listing.status !== "hidden" && (
                      <ActionButton onClick={() => setStatus(report, "action_taken")} disabled={isBusy}>
                        <EyeOff size={16} /> Hide listing
                      </ActionButton>
                    )}

                    {listing && (
                      <ActionButton tone="danger" onClick={() => deleteListing(report)} disabled={isBusy}>
                        {busy === `${report.id}:listing` ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                        Delete listing
                      </ActionButton>
                    )}

                    {canDeleteSeller && (
                      <ActionButton tone="danger" onClick={() => deleteSeller(report)} disabled={isBusy}>
                        {busy === `${report.id}:seller` ? <LoaderCircle size={16} className="animate-spin" /> : <UserX size={16} />}
                        Delete seller
                      </ActionButton>
                    )}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {lastPage > 1 && (
        <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4">
          <ActionButton onClick={() => load(page - 1)} disabled={page <= 1 || loading}>
            <ChevronLeft size={17} /> Previous
          </ActionButton>
          <p className="text-sm text-slate-600">
            Page {page} of {lastPage}
          </p>
          <ActionButton onClick={() => load(page + 1)} disabled={page >= lastPage || loading}>
            Next <ChevronRight size={17} />
          </ActionButton>
        </div>
      )}
    </div>
  );
}
