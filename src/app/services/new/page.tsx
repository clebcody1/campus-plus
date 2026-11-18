"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, LoaderCircle, ShieldCheck } from "lucide-react";
import ServiceForm from "@/components/ServiceForm";
import { API_URL } from "@/lib/api";

/**
 * Where students go to verify their school email.
 * Change this if your verification lives somewhere other than the profile.
 */
const VERIFY_URL = "/profile";

export default function NewServicePage() {
  const router = useRouter();

  const [checking, setChecking] = useState(true);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState("");

  /*
   | Asks the server rather than trusting the cached user in localStorage.
   | That copy is written at login and never updated, so a student who
   | verified an hour ago would still be blocked by it.
   */
  useEffect(() => {
    let cancelled = false;

    async function checkVerification() {
      const token = localStorage.getItem("campus_life_token");

      if (!token) {
        router.replace("/login");
        return;
      }

      try {
        const response = await fetch(`${API_URL}/user`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (response.status === 401) {
          router.replace("/login");
          return;
        }

        if (!response.ok) throw new Error("Could not check your account.");

        const data = await response.json();
        if (!cancelled) setVerified(Boolean(data.user?.is_verified));
      } catch (err) {
        if (!cancelled) {
          setError(
            err instanceof TypeError
              ? "Couldn't reach the server. Please check your connection and try again."
              : err instanceof Error
                ? err.message
                : "Something went wrong."
          );
        }
      } finally {
        if (!cancelled) setChecking(false);
      }
    }

    checkVerification();

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <main className="min-h-screen bg-[#F0F4F9] pb-16">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur">
        <Link
          href="/services"
          aria-label="Back to services"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-[#0B1F3A] transition hover:bg-slate-50"
        >
          <ArrowLeft size={18} />
        </Link>
        <h1 className="text-lg font-extrabold text-[#0B1F3A]">List your business</h1>
      </header>

      <div className="mx-auto max-w-2xl px-4 py-6">
        {checking ? (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-10 text-sm text-slate-600">
            <LoaderCircle size={20} className="animate-spin text-[#FF7900]" />
            Checking your account...
          </div>
        ) : error ? (
          <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </p>
        ) : !verified ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#FF7900]">
              <ShieldCheck size={26} />
            </span>

            <h2 className="mt-4 text-lg font-bold text-[#0B1F3A]">
              Verify your school email first
            </h2>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
              Only verified students can list a business. It takes a minute, and it is
              what lets other students trust the phone number they are about to call.
            </p>

            <Link
              href={VERIFY_URL}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[#FF7900] px-5 py-3 text-sm font-bold text-white transition hover:opacity-90"
            >
              <ShieldCheck size={16} /> Verify my account
            </Link>

            <Link
              href="/services"
              className="mt-4 block text-sm font-medium text-slate-500 hover:text-[#0B1F3A]"
            >
              Back to services
            </Link>
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm leading-6 text-slate-600">
              Students find services by searching here. Fill this in once and your
              business shows up whenever someone looks for what you do.
            </p>

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <ServiceForm />
            </div>
          </>
        )}
      </div>
    </main>
  );
}