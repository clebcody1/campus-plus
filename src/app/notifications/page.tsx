"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Heart, MessageCircle, UserPlus, CalendarCheck, Bell, CheckCheck,
} from "lucide-react";
import BrandMark from "@/components/BrandMark";
import { API_URL } from "@/lib/api";

const navy = "#0B1F3A";
const orange = "#FF7900";

type CampusNotification = {
  id: string;
  type: string;
  data: {
    type?: string;
    message?: string;
    url?: string;
    liker_name?: string;
    commenter_name?: string;
    follower_name?: string;
    follower_id?: number | string;
    post_id?: number | string;
    post_content?: string;
    comment_id?: number | string;
    comment_content?: string;
  };
  read_at: string | null;
  created_at: string;
};

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 12000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}

function readToken() {
  try {
    return window.localStorage.getItem("campus_life_token");
  } catch {
    return null;
  }
}

function timeAgo(dateString: string) {
  const seconds = Math.max(
    0,
    Math.floor((Date.now() - new Date(dateString).getTime()) / 1000),
  );
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return new Date(dateString).toLocaleDateString();
}

// Picks the icon from the notification's own type, falling back to the
// Laravel class name for rows saved before data.type existed.
function iconFor(notification: CampusNotification) {
  const kind = notification.data?.type ?? "";
  const cls = notification.type ?? "";

  if (kind === "post_liked" || cls.includes("PostLiked")) return Heart;
  if (kind === "comment_liked" || cls.includes("CommentLiked")) return Heart;
  if (kind === "post_commented" || kind === "post_comment" || cls.includes("PostCommented")) {
    return MessageCircle;
  }
  if (kind === "user_followed" || cls.includes("UserFollowed")) return UserPlus;
  if (kind === "organizer_application" || cls.includes("OrganizerApplication")) {
    return CalendarCheck;
  }
  return Bell;
}

export default function NotificationsPage() {
  const router = useRouter();

  const [notifications, setNotifications] = useState<CampusNotification[]>([]);
  const [serverUnread, setServerUnread] = useState(0);
  const [loading, setLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState("");

  // Count the unread ones from the list itself rather than trusting the
  // server's number. If the API ever stops sending unread_count, the badge
  // and the button keep working — and after a successful "mark all" this
  // falls to zero on its own.
  const listUnread = useMemo(
    () => notifications.filter((item) => !item.read_at).length,
    [notifications],
  );
  const unreadCount = notifications.length > 0 ? listUnread : serverUnread;

  const loadNotifications = useCallback(async () => {
    const token = readToken();

    if (!token) {
      setError("Please log in to see your notifications.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    setActionError("");

    try {
      const response = await fetchWithTimeout(`${API_URL}/notifications`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (response.status === 401) {
        throw new Error("Your session has expired. Please log in again.");
      }

      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Could not load notifications.");

      const list = result.notifications;
      setNotifications(Array.isArray(list) ? list : (list?.data ?? []));
      setServerUnread(Number(result.unread_count ?? 0));
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      setError(
        timedOut
          ? `The API didn't answer. The app is calling ${API_URL}.`
          : err instanceof Error
            ? err.message
            : "Could not load notifications. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
  }, [loadNotifications]);

  /**
   * Works out where a notification should take you.
   *
   * The backend can supply a url, but a bare "/" is a placeholder, not a
   * destination — trusting it is what sent every click to the home page.
   * Ignore it and work the target out from the ids, which every
   * notification already carries.
   *
   * Order matters here: a like or comment notification holds both a post id
   * and the person who did it. The post is what you want to see.
   */
  function destinationFor(notification: CampusNotification) {
    const data = notification.data ?? {};

    const url = typeof data.url === "string" ? data.url.trim() : "";
    if (url.startsWith("/") && url !== "/") return url;

    if (data.post_id) {
      const postPath = `/post/${encodeURIComponent(String(data.post_id))}`;
      return data.comment_id
        ? `${postPath}?comment=${encodeURIComponent(String(data.comment_id))}`
        : postPath;
    }

    if (data.follower_id) {
      return `/users/${encodeURIComponent(String(data.follower_id))}`;
    }

    return null;
  }

  async function openNotification(notification: CampusNotification) {
    const token = readToken();

    // Mark as read, but never let a failed request stop the navigation.
    if (!notification.read_at && token) {
      try {
        const response = await fetchWithTimeout(
          `${API_URL}/notifications/${encodeURIComponent(notification.id)}/read`,
          {
            method: "PATCH",
            headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
          },
        );

        if (response.ok) {
          setNotifications((current) =>
            current.map((item) =>
              item.id === notification.id
                ? { ...item, read_at: new Date().toISOString() }
                : item,
            ),
          );
          setServerUnread((current) => Math.max(0, current - 1));
        }
      } catch {
        // Still open the notification even if marking it read failed.
      }
    }

    const destination = destinationFor(notification);
    if (destination) router.push(destination);
  }

  /**
   * Clears the whole badge in one request. The rows turn white immediately;
   * if the server refuses, the orange comes back and says why rather than
   * reverting in silence.
   */
  async function markAllRead() {
    if (markingAll || unreadCount === 0) return;

    const token = readToken();
    if (!token) {
      setActionError("Please log in again.");
      return;
    }

    const now = new Date().toISOString();
    const snapshot = notifications;
    const snapshotUnread = serverUnread;

    setMarkingAll(true);
    setActionError("");
    setNotifications((current) =>
      current.map((item) => (item.read_at ? item : { ...item, read_at: now })),
    );
    setServerUnread(0);

    try {
      const response = await fetchWithTimeout(`${API_URL}/notifications/read-all`, {
        method: "PATCH",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });

      const result = await response.json().catch(() => ({}));

      if (response.status === 401) {
        throw new Error("Your session has expired. Please log in again.");
      }

      if (!response.ok) {
        throw new Error(
          result.message || `The server rejected the request (${response.status}).`,
        );
      }
    } catch (err) {
      // Put the orange back — a badge that lies is worse than one that's late.
      setNotifications(snapshot);
      setServerUnread(snapshotUnread);
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      setActionError(
        timedOut
          ? `The API didn't answer. The app is calling ${API_URL}.`
          : err instanceof Error
            ? err.message
            : "Could not mark them all as read.",
      );
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-12 text-slate-900">
      <header className="sticky top-0 z-20 bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <Link
            href="/"
            aria-label="Back to the Campus Plus feed"
            title="Back to feed"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100"
          >
            <ArrowLeft size={23} strokeWidth={2} />
          </Link>

          <Link href="/" aria-label="Campus Plus home" className="shrink-0">
            <BrandMark size={40} className="rounded-xl" />
          </Link>

          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-extrabold" style={{ color: navy }}>
              Notifications
            </h1>
            <p className="text-sm text-slate-500">
              Stay up to date with your campus community.
            </p>
          </div>

          {unreadCount > 0 && (
            <span
              className="shrink-0 rounded-full px-3 py-1 text-xs font-bold text-white"
              style={{ backgroundColor: orange }}
            >
              {unreadCount} unread
            </span>
          )}
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-extrabold" style={{ color: navy }}>
            Recent activity
          </h2>

          <div className="flex items-center gap-4">
            {unreadCount > 0 && (
              <button
                type="button"
                onClick={() => void markAllRead()}
                disabled={markingAll}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-bold transition hover:bg-slate-50 disabled:opacity-50"
                style={{ color: navy }}
              >
                <CheckCheck size={15} />
                {markingAll ? "Marking..." : "Mark all read"}
              </button>
            )}

            <button
              type="button"
              onClick={() => void loadNotifications()}
              className="text-sm font-semibold"
              style={{ color: orange }}
            >
              Refresh
            </button>
          </div>
        </div>

        {actionError && (
          <div
            role="alert"
            className="mb-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700"
          >
            {actionError}
          </div>
        )}

        {loading && (
          <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
            Loading notifications...
          </div>
        )}

        {!loading && error && (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-white p-5 text-sm text-red-700"
          >
            {error}{" "}
            <button
              type="button"
              onClick={() => void loadNotifications()}
              className="font-bold underline"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && notifications.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <div
              className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full"
              style={{ backgroundColor: "#FFF3E8", color: orange }}
            >
              <Bell size={26} strokeWidth={1.8} />
            </div>

            <h3 className="font-extrabold" style={{ color: navy }}>
              You&rsquo;re all caught up
            </h3>

            <p className="mt-2 text-sm text-slate-500">
              When students interact with your posts or follow you,
              notifications will appear here.
            </p>

            <Link
              href="/"
              className="mt-4 inline-flex rounded-full px-5 py-2 text-sm font-bold text-[#0B1F3A]"
              style={{ backgroundColor: orange }}
            >
              Back to feed
            </Link>
          </div>
        )}

        {!loading && !error && notifications.length > 0 && (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {notifications.map((notification) => {
              const data = notification.data ?? {};
              const message = data.message || "You have a new notification.";
              const Icon = iconFor(notification);
              const clickable = destinationFor(notification) !== null;

              return (
                <button
                  key={notification.id}
                  type="button"
                  onClick={() => void openNotification(notification)}
                  className={`flex w-full items-start gap-3 border-b border-slate-100 p-4 text-left transition last:border-b-0 hover:bg-slate-50 ${
                    notification.read_at ? "bg-white" : "bg-orange-50/60"
                  } ${clickable ? "cursor-pointer" : "cursor-default"}`}
                >
                  <span
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full"
                    style={{ backgroundColor: "#FFF3E8", color: orange }}
                  >
                    <Icon size={20} strokeWidth={1.9} aria-hidden="true" />
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800">
                      {message}
                    </span>

                    {data.post_content && (
                      <span className="mt-1 block truncate text-xs text-slate-500">
                        Post: &ldquo;{data.post_content}&rdquo;
                      </span>
                    )}

                    {data.comment_content && (
                      <span className="mt-1 block truncate text-xs text-slate-600">
                        Comment: &ldquo;{data.comment_content}&rdquo;
                      </span>
                    )}

                    <span className="mt-2 block text-xs text-slate-500">
                      {timeAgo(notification.created_at)}
                    </span>
                  </span>

                  {!notification.read_at && (
                    <span
                      className="mt-2 h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: orange }}
                      aria-label="Unread"
                    />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}