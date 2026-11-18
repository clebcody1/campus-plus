"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, Store } from "lucide-react";
import ServiceForm, { type ServiceDraft } from "@/components/ServiceForm";
import { API_URL } from "@/lib/api";

export default function EditServicePage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id ?? "");

  const [service, setService] = useState<ServiceDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [denied, setDenied] = useState(false);

  const load = useCallback(async () => {
    const token = localStorage.getItem("campus_life_token");

    if (!token) {
      router.replace("/login");
      return;
    }

    try {
      const response = await fetch(`${API_URL}/services/${id}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (response.status === 401) {
        router.replace("/login");
        return;
      }

      if (!response.ok) throw new Error("Could not load this listing.");

      const data = await response.json();

      /*
       | The server rejects an edit from anyone but the owner, but checking
       | here too means a wrong link shows a clear message instead of a form
       | that fails on submit.
       */
      if (!data.is_owner) {
        setDenied(true);
        return;
      }

      setService(data.service ?? null);
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
  }, [id, router]);

  useEffect(() => {
    if (id) load();
  }, [id, load]);

  return (
    <main className="min-h-screen bg-[#F0F4F9] pb-16">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <Link
          href={`/services/${id}`}
          aria-label="Back to the listing"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-[#0B1F3A] transition hover:bg-slate-50"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-extrabold text-[#0B1F3A]">Edit listing</h1>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-600">
            <LoaderCircle size={20} className="animate-spin text-[#FF7900]" />
            Loading your listing...
          </div>
        ) : denied ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#FF7900]">
              <Store size={26} />
            </span>
            <h2 className="mt-4 text-lg font-bold text-[#0B1F3A]">
              This is not your listing
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
              Only the student who listed a business can edit it.
            </p>
            <Link
              href={`/services/${id}`}
              className="mt-6 inline-block rounded-xl bg-[#FF7900] px-5 py-3 text-sm font-bold text-white hover:opacity-90"
            >
              View the listing
            </Link>
          </div>
        ) : error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : service ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
            <ServiceForm existing={service} />
          </div>
        ) : null}
      </div>
    </main>
  );
}