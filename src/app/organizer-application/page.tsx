"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, Clock3, XCircle } from "lucide-react";

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "https://api.campusplus.com.ng/api";

type OrganizerApplication = {
  id: number;
  organization_name: string | null;
  reason: string;
  status: "pending" | "approved" | "rejected";
  admin_notes?: string | null;
  created_at?: string;
  reviewed_at?: string | null;
};

export default function OrganizerApplicationPage() {
  const [application, setApplication] =
    useState<OrganizerApplication | null>(null);
  const [organizationName, setOrganizationName] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadApplication = useCallback(async () => {
    const token = localStorage.getItem("campus_life_token");

    if (!token) {
      setError("Please log in to apply to organize events.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch(
        `${API_URL}/organizer-applications/me`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
          cache: "no-store",
        }
      );

      const result = await response.json();

      if (response.status === 401) {
        throw new Error("Your session has expired. Please log in again.");
      }

      if (!response.ok) {
        throw new Error(result.message || "Could not load your application.");
      }

      const current = result.application ?? null;
      setApplication(current);

      if (current) {
        setOrganizationName(current.organization_name ?? "");
        setReason(current.reason ?? "");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not load your application."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadApplication();
  }, [loadApplication]);

  async function submitApplication(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const token = localStorage.getItem("campus_life_token");

    if (!token) {
      setError("Please log in before submitting an application.");
      return;
    }

    if (reason.trim().length < 10) {
      setError("Please explain your reason in at least 10 characters.");
      return;
    }

    setSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API_URL}/organizer-applications`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          organization_name: organizationName.trim() || null,
          reason: reason.trim(),
        }),
      });

      const result = await response.json();

      if (response.status === 401) {
        throw new Error("Your session has expired. Please log in again.");
      }

      if (!response.ok) {
        throw new Error(
          result.message || "Could not submit your application."
        );
      }

      setApplication(result.application);
      setMessage(
        result.message || "Your organizer application has been submitted."
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#F0F4F9] px-4 py-6 text-[#0B1F3A] sm:px-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/profile"
          className="mb-6 inline-flex items-center gap-2 text-sm font-semibold text-slate-600 transition hover:text-[#FF7900]"
        >
          <ArrowLeft size={17} />
          Back to Profile
        </Link>

        <section className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
          <div className="bg-[#0B1F3A] px-6 py-8 text-white sm:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#FF7900]">
              Campus Life
            </p>
            <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
              Apply to Organize Events
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-6 text-white/75">
              Bring your campus community together. Submit your application
              for admin review to become an event organizer.
            </p>
          </div>

          <div className="p-6 sm:p-8">
            {loading ? (
              <p className="py-8 text-center text-sm text-slate-500">
                Loading your application...
              </p>
            ) : error && !application ? (
              <div>
                <p role="alert" className="text-sm text-red-600">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setError("");
                    setLoading(true);
                    void loadApplication();
                  }}
                  className="mt-4 rounded-xl bg-[#0B1F3A] px-5 py-3 text-sm font-bold text-white hover:bg-[#17385f]"
                >
                  Try again
                </button>
              </div>
            ) : application?.status === "pending" ? (
              <div>
                <div className="flex items-start gap-3 rounded-2xl bg-amber-50 p-4">
                  <Clock3 className="mt-0.5 shrink-0 text-amber-700" size={22} />
                  <div>
                    <h2 className="font-bold text-amber-800">
                      Application pending
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-amber-800">
                      Your application has been submitted and is awaiting
                      admin review. You can check your notifications for
                      updates.
                    </p>
                  </div>
                </div>

                <ApplicationDetails application={application} />
              </div>
            ) : application?.status === "approved" ? (
              <div>
                <div className="flex items-start gap-3 rounded-2xl bg-green-50 p-4">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-green-700" size={22} />
                  <div>
                    <h2 className="font-bold text-green-800">
                      You&apos;re approved!
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-green-800">
                      You can now create events on Campus Life.
                    </p>
                  </div>
                </div>

                <ApplicationDetails application={application} />

                <Link
                  href="/events"
                  className="mt-6 inline-flex rounded-xl bg-[#FF7900] px-5 py-3 text-sm font-bold text-white transition hover:bg-orange-600"
                >
                  Go to Campus Events
                </Link>
              </div>
            ) : (
              <>
                {application?.status === "rejected" && (
                  <div className="mb-6 rounded-2xl bg-red-50 p-4">
                    <h2 className="font-bold text-red-800">
                      Your previous application was not approved
                    </h2>
                    <p className="mt-1 text-sm leading-6 text-red-700">
                      {application.admin_notes ||
                        "You may submit a new application with more information."}
                    </p>
                  </div>
                )}

                {message && (
                  <p
                    role="status"
                    className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800"
                  >
                    {message}
                  </p>
                )}

                {error && (
                  <p role="alert" className="mb-4 text-sm text-red-600">
                    {error}
                  </p>
                )}

                <form onSubmit={submitApplication} className="space-y-5">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">
                      Organization or group name
                    </span>
                    {/* text-base is 16px. Anything smaller makes mobile Safari
                        zoom into the field on focus, which throws the whole
                        page out of alignment. */}
                    <input
                      value={organizationName}
                      onChange={(event) =>
                        setOrganizationName(event.target.value)
                      }
                      maxLength={255}
                      placeholder="e.g. Campus Tech Community"
                      className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-base outline-none transition focus:border-[#FF7900] focus:ring-2 focus:ring-[#FF7900]/15"
                    />
                    <span className="mt-2 block text-xs text-slate-500">
                      Optional. Leave blank if you are applying as an individual.
                    </span>
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold">
                      Why do you want to organize events?
                    </span>
                    <textarea
                      required
                      minLength={10}
                      maxLength={2000}
                      rows={6}
                      value={reason}
                      onChange={(event) => setReason(event.target.value)}
                      placeholder="Tell us about the events you want to organize and how they will benefit your campus community."
                      className="w-full resize-y rounded-xl border border-gray-200 bg-white px-4 py-3 text-base leading-6 outline-none transition focus:border-[#FF7900] focus:ring-2 focus:ring-[#FF7900]/15"
                    />
                    <span className="mt-2 block text-right text-xs text-slate-500">
                      {reason.length}/2000
                    </span>
                  </label>

                  <p className="text-sm leading-6 text-slate-500">
                    Your application will be reviewed by an admin. You will
                    receive an update when a decision is made.
                  </p>

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full rounded-xl bg-[#FF7900] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-orange-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting ? "Submitting..." : "Submit application"}
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function ApplicationDetails({
  application,
}: {
  application: OrganizerApplication;
}) {
  const status = statusStylesFor(application.status);
  const StatusIcon = status.icon;

  return (
    <div className="mt-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-extrabold">Your application</h2>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold ${status.className}`}
        >
          <StatusIcon size={14} />
          {status.label}
        </span>
      </div>

      <div className="space-y-4 rounded-2xl border border-gray-100 p-4">
        <div>
          <p className="text-xs font-semibold text-slate-500">
            Organization or group
          </p>
          <p className="mt-1 text-sm font-semibold">
            {application.organization_name || "Individual application"}
          </p>
        </div>
        <div>
          <p className="text-xs font-semibold text-slate-500">
            Reason for applying
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
            {application.reason}
          </p>
        </div>
        {application.admin_notes && (
          <div>
            <p className="text-xs font-semibold text-slate-500">
              Admin feedback
            </p>
            <p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-700">
              {application.admin_notes}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function statusStylesFor(status: OrganizerApplication["status"]) {
  if (status === "approved") {
    return {
      label: "Approved",
      icon: CheckCircle2,
      className: "bg-green-50 text-green-700",
    };
  }

  if (status === "rejected") {
    return {
      label: "Not approved",
      icon: XCircle,
      className: "bg-red-50 text-red-700",
    };
  }

  return {
    label: "Pending review",
    icon: Clock3,
    className: "bg-amber-50 text-amber-700",
  };
}