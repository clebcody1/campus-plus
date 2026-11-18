"use client";

import { Fragment, Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { API_URL, storageUrl } from "@/lib/api";

import {
  Home as HomeIcon, CalendarDays, ShoppingBag, UserRound, Heart, MessageCircle,
  Bell, ImagePlus, X, Calculator, Flag, GraduationCap, RefreshCw, ArrowUp,
  MoreHorizontal, ArrowRight, SquarePen, Trash2, Store, Globe2,
} from "lucide-react";

import WelcomeScreen from "@/components/WelcomeScreen";
import BrandMark from "@/components/BrandMark";
import SearchBox from "@/components/SearchBox";
import BottomNav from "@/components/BottomNav";
import VerifiedBadge from "@/components/VerifiedBadge";
import PostImages from "@/components/PostImages";
import FeaturedServices, { type FeaturedService } from "@/components/FeaturedServices";
import FeaturedAd from "@/components/FeaturedAd";

const navy = "#0B1F3A";
const orange = "#FF7900";

// You can edit a post for five minutes after posting. The server enforces
// this as well — this only decides when the button disappears.
const EDIT_WINDOW_MS = 5 * 60 * 1000;

// How often to quietly check for new posts while the tab is open.
const POLL_MS = 45000;

/*
 | One promoted business after every four posts.
 */
const AD_EVERY = 4;

const TOKEN_KEY = "campus_life_token";
const USER_KEY = "campus_life_user";

// Diagnostic detail belongs in the console, never on a student's screen.
// In production this does nothing, so API addresses and HTTP status codes
// stay out of the interface.
function logDev(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") console.error(...args);
}

type ApiUser = {
  id: number;
  name: string;
  university?: string | null;
  is_verified?: boolean;
  role?: string;
  avatar_path?: string | null;
};

type ApiPost = {
  id: number;
  user_id: number;
  content: string;
  image_path: string | null;
  image_paths?: string[] | null;
  // The post's own campus, not the author's. NULL means platform-wide.
  university?: string | null;
  created_at: string;
  updated_at?: string;
  likes_count?: number;
  comments_count?: number;
  liked_by_me?: boolean;
  user?: ApiUser;
};

type ApiEvent = {
  id?: number;
  title?: string;
  name?: string;
  event_name?: string;
  location?: string;
  venue?: string;
  place?: string;
  start_date?: string;
  date?: string;
  starts_at?: string;
  event_date?: string;
};

type CampusEvent = { id: string; day: string; month: string; title: string; place: string };

type FeedPost = {
  id: number;
  initials: string;
  avatarUrl: string | null;
  name: string;
  school: string;
  platformWide: boolean;
  createdAt: string;
  edited: boolean;
  text: string;
  imagePaths: string[];
  likesCount: number;
  commentsCount: number;
  likedByMe: boolean;
  likeBusy: boolean;
  verified: boolean;
  adminBadge: boolean;
  userId: number;
};

// A fetch that gives up instead of hanging. Without this, an API that never
// answers — wrong NEXT_PUBLIC_API_URL, Laravel not running, laptop moved to
// a different network — leaves the page on its spinner with no explanation.
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
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    // Private browsing can block localStorage entirely.
    return null;
  }
}

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CP";
}

function timeAgo(dateString: string) {
  const ms = new Date(dateString).getTime();
  if (Number.isNaN(ms)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return new Date(dateString).toLocaleDateString();
}

function toFeedPost(post: ApiPost): FeedPost {
  const name = post.user?.name || "Campus Plus student";
  // Laravel bumps updated_at on every save, so a gap of more than a second
  // from created_at means the author came back and changed it.
  const edited = Boolean(
    post.updated_at &&
      new Date(post.updated_at).getTime() - new Date(post.created_at).getTime() > 2000,
  );

  /*
   | A NULL campus on the post itself means it was published platform-wide,
   | which only an admin can do.
   |
   | Strict === null on purpose: an older build of the API that doesn't send
   | the field at all gives undefined, and undefined must not be read as
   | "show this to everyone".
   */
  const platformWide = post.university === null;

  return {
    id: post.id,
    initials: getInitials(name),
    avatarUrl: storageUrl(post.user?.avatar_path),
    name,
    // The author's own school is misleading on a platform-wide post: it is
    // not a message from LAUTECH, it is a message from Campus Plus.
    school: platformWide ? "Campus Plus" : (post.user?.university || "Campus Plus"),
    platformWide,
    createdAt: post.created_at,
    edited,
    text: post.content,
    // New posts carry the whole list; older ones only have the single column.
    imagePaths: (post.image_paths?.length ? post.image_paths : [post.image_path])
      .filter((p): p is string => Boolean(p)),
    likesCount: Number(post.likes_count ?? 0),
    commentsCount: Number(post.comments_count ?? 0),
    likedByMe: Boolean(post.liked_by_me),
    likeBusy: false,
    verified: Boolean(post.user?.is_verified),
    adminBadge: post.user?.role === "admin",
    userId: post.user?.id ?? post.user_id,
  };
}

const navigationItems = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/events" },
  { label: "Chat", href: "/chat" },
  { label: "Market", href: "/market" },
  { label: "Profile", href: "/profile" },
];

function Avatar({ initials, src, small = false }: { initials: string; src?: string | null; small?: boolean }) {
  const [failed, setFailed] = useState(false);
  const size = small ? "h-8 w-8 text-xs" : "h-11 w-11";

  return (
    <div className={`flex ${size} shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-100 font-bold text-orange-700`}>
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        initials
      )}
    </div>
  );
}

function ProfileLink({
  userId, className, children,
}: {
  userId?: number | string | null; className?: string; children: React.ReactNode;
}) {
  if (!userId) return <div className={className}>{children}</div>;
  return <Link href={`/users/${userId}`} className={className}>{children}</Link>;
}

const footerIcons = {
  home: HomeIcon, events: CalendarDays, chat: MessageCircle,
  market: ShoppingBag, profile: UserRound,
} as const;

const iconNames = { Home: "home", Events: "events", Chat: "chat", Market: "market", Profile: "profile" } as const;

function FooterIcon({ name }: { name: keyof typeof footerIcons }) {
  const Icon = footerIcons[name];
  return <Icon size={20} strokeWidth={1.8} aria-hidden="true" />;
}

function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-2" aria-label="Campus sections">
      {navigationItems.map(({ label, href }) => {
        const active = href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
        const isChat = label === "Chat";
        const desktopLabel = label === "Market" ? "Marketplace" : label === "Profile" ? "My profile" : label;
        const iconName = iconNames[label as keyof typeof iconNames];

        if (isChat) {
          return (
            <Link
              key={label}
              href={href}
              aria-current={active ? "page" : undefined}
              className={`my-3 flex items-center gap-3 rounded-full py-2 pl-2 pr-5 text-sm font-bold shadow-md shadow-[#FF7900]/30 transition hover:-translate-y-0.5 active:scale-95 ${
                active ? "text-white" : "text-[#0B1F3A]"
              }`}
              style={{ backgroundColor: active ? navy : orange }}
            >
              <span
                className="flex h-9 w-9 items-center justify-center rounded-full text-white"
                style={{ backgroundColor: active ? orange : navy }}
              >
                <FooterIcon name={iconName} />
              </span>
              {desktopLabel}
            </Link>
          );
        }

        return (
          <Link
            key={label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${active ? "text-white" : "text-slate-600 hover:bg-slate-50"}`}
            style={active ? { backgroundColor: navy } : undefined}
          >
            <FooterIcon name={iconName} />
            {desktopLabel}
          </Link>
        );
      })}
    </nav>
  );
}

export default function Home() {
  const router = useRouter();
  const [today, setToday] = useState("");

  useEffect(() => {
    setToday(new Date().toLocaleDateString("en-NG", { weekday: "long", month: "long", day: "numeric" }));
  }, []);

  // ------------------------------------------------------------- me
  const [me, setMe] = useState<{ id?: number; name: string; avatarUrl: string | null } | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Show the saved copy straight away so the page isn't blank, then confirm
    // with the server. The server is what gives us a reliable id, which is
    // what decides whether Edit and Delete appear on a post.
    try {
      const raw = window.localStorage.getItem(USER_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed.name === "string") {
        setMe({
          id: Number(parsed.id) || undefined,
          name: parsed.name,
          avatarUrl: storageUrl(parsed.avatar_path),
        });
      }
    } catch {
      // A corrupt cached user just means we wait for the server.
    }

    const token = readToken();
    if (!token) return;

    fetchWithTimeout(`${API_URL}/user`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        const user = data?.user ?? data;
        if (!cancelled && user && typeof user.name === "string") {
          // A marker that survives until a deliberate logout. If the token is
          // ever missing but this is still here, the session was ended on
          // purpose rather than wiped by the browser.
          try {
            window.localStorage.setItem("campus_life_seen", new Date().toISOString());
          } catch {
            // Not worth failing over.
          }

          setMe({
            id: Number(user.id) || undefined,
            name: user.name,
            avatarUrl: storageUrl(user.avatar_path),
          });
        }
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  function myAvatar(userId?: number | null) {
    return me?.id && userId && me.id === userId ? me.avatarUrl : null;
  }

  // ------------------------------------------------------------- state
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [postsLoading, setPostsLoading] = useState(true);
  const [postsError, setPostsError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  // Posts that arrived while you were reading. Held back so the page never
  // jumps under your thumb — you decide when they appear.
  const [waiting, setWaiting] = useState<FeedPost[]>([]);
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(true);
  const [unread, setUnread] = useState(0);

  /*
   | Promoted businesses, fetched once and reused for every ad slot in the
   | feed. Fetched here rather than inside each card so a long scroll makes
   | one request, not twelve.
   */
  const [featuredAds, setFeaturedAds] = useState<FeaturedService[]>([]);

  useEffect(() => {
    let cancelled = false;

    /*
     | The token matters here.
     |
     | Without it this request reaches the API as a guest, and the campus
     | scope falls back to the default school rather than this student's
     | own. A student at any university other than the default would be
     | shown promoted listings from a campus they have never been to.
     */
    const token = readToken();

    fetchWithTimeout(`${API_URL}/services`, {
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        setFeaturedAds(Array.isArray(data?.featured) ? data.featured : []);
      })
      .catch(() => {
        // Nothing promoted is a normal state, so this stays silent.
      });

    return () => { cancelled = true; };
  }, []);

  // Which post ids are already on screen. Kept in a ref so the background
  // check can read it without reaching inside a state updater — updaters
  // must stay pure, and React runs them twice in development.
  const knownIdsRef = useRef<number[]>([]);
  useEffect(() => {
    knownIdsRef.current = posts.map((p) => p.id);
  }, [posts]);

  // Re-render once a minute so "2 min ago" doesn't sit there saying "Just now".
  const [, setClock] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setClock((c) => c + 1), 60000);
    return () => window.clearInterval(id);
  }, []);

  // Report post
  const [openPostMenuId, setOpenPostMenuId] = useState<number | null>(null);
  const [activeReportPost, setActiveReportPost] = useState<FeedPost | null>(null);
  const [reportReason, setReportReason] = useState("spam");
  const [reportDetails, setReportDetails] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);

  // Edit post
  const [editingPost, setEditingPost] = useState<FeedPost | null>(null);
  const [editText, setEditText] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  const anyModalOpen = Boolean(activeReportPost || editingPost);

  function canEditPost(post: FeedPost) {
    if (!me?.id || post.userId !== me.id) return false;
    return Date.now() - new Date(post.createdAt).getTime() < EDIT_WINDOW_MS;
  }

  function isMine(post: FeedPost) {
    return Boolean(me?.id && post.userId === me.id);
  }

  function openPost(event: React.MouseEvent, postId: number) {
    const target = event.target as HTMLElement;
    // Let buttons, links and fields behave normally, and don't navigate away
    // from text somebody has just selected. Photos in the feed are plain
    // divs, not buttons, so a tap on one lands here and opens the post.
    if (target.closest("button, a, input, textarea, select, [data-post-menu]")) return;
    if (window.getSelection()?.toString()) return;
    router.push(`/post/${postId}`);
  }

  // ------------------------------------------------------------- posts
  const fetchPosts = useCallback(async (): Promise<FeedPost[]> => {
    const token = readToken();
    const response = await fetchWithTimeout(`${API_URL}/posts`, {
      headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      cache: "no-store",
    });
    if (!response.ok) {
      // The status code helps you, not the student reading the feed.
      logDev(`GET ${API_URL}/posts failed with ${response.status}`);
      throw new Error("We couldn't load posts right now. Please try again.");
    }
    const result = await response.json();
    const apiPosts: ApiPost[] = Array.isArray(result) ? result : (result.data ?? []);
    return apiPosts.map(toFeedPost);
  }, []);

  // A full replace: first load, and the Refresh button.
  const loadPosts = useCallback(async (showSpinner: boolean) => {
    if (showSpinner) setPostsLoading(true);
    else setRefreshing(true);
    setPostsError("");

    try {
      const fresh = await fetchPosts();
      setPosts(fresh);
      setWaiting([]);
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      logDev(`Failed to load posts from ${API_URL}`, err);
      setPostsError(
        timedOut
          ? "The server is taking too long to respond. Please try again."
          : "We couldn't load posts right now. Please check your connection and try again.",
      );
    } finally {
      // Runs on every path, so the page can never sit on its spinner.
      setPostsLoading(false);
      setRefreshing(false);
    }
  }, [fetchPosts]);

  // The quiet background check. New posts go into `waiting` rather than being
  // spliced in; counts on posts already on screen update in place, which
  // changes no heights and so cannot move the page under you.
  const checkForNew = useCallback(async () => {
    try {
      const fresh = await fetchPosts();

      setPosts((current) => {
        if (current.length === 0) return current;
        const byId = new Map(fresh.map((p) => [p.id, p]));
        return current.map((p) => {
          const f = byId.get(p.id);
          // Leave a post alone while its like request is in flight, or the
          // server's older count would overwrite the optimistic one.
          if (!f || p.likeBusy) return p;
          return {
            ...p,
            text: f.text,
            edited: f.edited,
            imagePaths: f.imagePaths,
            likesCount: f.likesCount,
            commentsCount: f.commentsCount,
            likedByMe: f.likedByMe,
          };
        });
      });

      const known = new Set(knownIdsRef.current);
      const brandNew = fresh.filter((p) => !known.has(p.id));
      setWaiting(brandNew);
    } catch {
      // A failed background check is not worth interrupting anyone over.
    }
  }, [fetchPosts]);

  const loadUnread = useCallback(async () => {
    const token = readToken();
    if (!token) {
      setUnread(0);
      return;
    }
    try {
      const response = await fetchWithTimeout(`${API_URL}/notifications`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) return;
      const result = await response.json();
      setUnread(Number(result.unread_count ?? 0));
    } catch {
      // Leave the dot as it is.
    }
  }, []);

  useEffect(() => {
    void loadPosts(true);
    void loadUnread();
  }, [loadPosts, loadUnread]);

  // One timer for everything. Polls only while the tab is visible, and checks
  // immediately whenever someone comes back to it — the moment they most
  // expect fresh content.
  useEffect(() => {
    function tick() {
      if (document.visibilityState !== "visible") return;
      if (anyModalOpen) return;
      void checkForNew();
      void loadUnread();
    }

    const id = window.setInterval(tick, POLL_MS);
    window.addEventListener("focus", tick);
    document.addEventListener("visibilitychange", tick);

    return () => {
      window.clearInterval(id);
      window.removeEventListener("focus", tick);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [checkForNew, loadUnread, anyModalOpen]);

  function showWaiting() {
    if (!waiting.length) return;
    setPosts((current) => [...waiting, ...current]);
    setWaiting([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // ------------------------------------------------------------- events
  useEffect(() => {
    let cancelled = false;

    async function loadEvents() {
      setEventsLoading(true);
      try {
        const token = readToken();
        const response = await fetchWithTimeout(`${API_URL}/events`, {
          headers: { Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not load events");
        const result = await response.json();
        const list: ApiEvent[] = Array.isArray(result)
          ? result
          : (result.data ?? result.events?.data ?? result.events ?? []);
        const mapped = list.map((event, index) => {
          const rawDate = event.start_date ?? event.starts_at ?? event.event_date ?? event.date;
          const date = rawDate ? new Date(rawDate) : null;
          const validDate = date && !Number.isNaN(date.getTime());
          return {
            id: String(event.id ?? `${event.title ?? event.name ?? "event"}-${index}`),
            day: validDate ? String(date.getDate()).padStart(2, "0") : "—",
            month: validDate ? date.toLocaleString("en-US", { month: "short" }).toUpperCase() : "EVENT",
            title: event.title ?? event.event_name ?? event.name ?? "Campus event",
            place: event.location ?? event.venue ?? event.place ?? "Location to be announced",
          };
        });
        if (!cancelled) setEvents(mapped);
      } catch (err) {
        logDev("Failed to load events", err);
        if (!cancelled) setEvents([]);
      } finally {
        if (!cancelled) setEventsLoading(false);
      }
    }

    void loadEvents();
    return () => { cancelled = true; };
  }, []);

  // ------------------------------------------------------------- modals
  useEffect(() => {
    if (!anyModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    const previousOverscroll = document.body.style.overscrollBehavior;
    const previousPaddingRight = document.body.style.paddingRight;
    const previousBackground = document.body.style.backgroundColor;

    // Hiding the page scrollbar widens the layout and shifts everything
    // sideways. Add the scrollbar's width back as padding so nothing moves,
    // and paint that strip the page colour so it isn't a white bar.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = "hidden";
    document.body.style.overscrollBehavior = "none";
    document.body.style.backgroundColor = "#f8fafc";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.overscrollBehavior = previousOverscroll;
      document.body.style.paddingRight = previousPaddingRight;
      document.body.style.backgroundColor = previousBackground;
    };
  }, [anyModalOpen]);

  useEffect(() => {
    if (openPostMenuId === null) return;
    function onPointerDown(event: MouseEvent) {
      if (!(event.target as HTMLElement).closest("[data-post-menu]")) setOpenPostMenuId(null);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenPostMenuId(null);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openPostMenuId]);

  // ------------------------------------------------------------- likes
  async function handleToggleLike(postId: number) {
    const token = readToken();
    if (!token) {
      alert("Please log in to like posts.");
      return;
    }

    const currentPost = posts.find((post) => post.id === postId);
    if (!currentPost || currentPost.likeBusy) return;

    setPosts((current) => current.map((post) => (post.id === postId ? { ...post, likeBusy: true } : post)));

    try {
      const response = await fetchWithTimeout(`${API_URL}/posts/${postId}/like`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });

      if (response.status === 401) {
        alert("Your session has expired. Please log in again.");
        return;
      }

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Could not update like.");

      setPosts((current) =>
        current.map((post) =>
          post.id === postId
            ? {
                ...post,
                likedByMe: Boolean(result.liked_by_me),
                likesCount: Number(result.likes_count ?? post.likesCount),
              }
            : post,
        ),
      );
    } catch (error) {
      logDev("Failed to toggle like", error);
      alert(error instanceof Error ? error.message : "Could not update like. Please try again.");
    } finally {
      setPosts((current) => current.map((post) => (post.id === postId ? { ...post, likeBusy: false } : post)));
    }
  }

  // --------------------------------------------------------- edit post
  function startEdit(post: FeedPost) {
    setOpenPostMenuId(null);
    setEditingPost(post);
    setEditText(post.text);
    setEditError("");
  }

  async function saveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingPost || editSaving) return;

    const content = editText.trim();
    if (!content) {
      setEditError("A post cannot be empty.");
      return;
    }

    const token = readToken();
    if (!token) {
      setEditError("Please log in again.");
      return;
    }

    setEditSaving(true);
    setEditError("");

    try {
      const response = await fetchWithTimeout(`${API_URL}/posts/${editingPost.id}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        const validation = result?.errors ? Object.values(result.errors).flat().join(" ") : "";
        throw new Error(validation || result?.message || "Could not save your changes.");
      }

      const savedId = editingPost.id;
      setPosts((current) =>
        current.map((post) => (post.id === savedId ? { ...post, text: content, edited: true } : post)),
      );
      setEditingPost(null);
    } catch (error) {
      logDev("Failed to save post edit", error);
      setEditError(error instanceof Error ? error.message : "Could not save your changes.");
    } finally {
      setEditSaving(false);
    }
  }

  // ------------------------------------------------------- delete post
  async function deletePost(post: FeedPost) {
    setOpenPostMenuId(null);

    if (!window.confirm("Delete this post? This cannot be undone.")) return;

    const token = readToken();
    if (!token) {
      alert("Please log in again.");
      return;
    }

    // Take it off screen straight away, and put it back if the server says no.
    const snapshot = posts;
    setPosts((current) => current.filter((p) => p.id !== post.id));

    try {
      const response = await fetchWithTimeout(`${API_URL}/posts/${post.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Could not delete the post.");
    } catch (error) {
      logDev("Failed to delete post", error);
      setPosts(snapshot);
      alert(error instanceof Error ? error.message : "Could not delete the post.");
    }
  }

  // ------------------------------------------------------------ report
  async function submitPostReport(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeReportPost || reportSubmitting) return;

    const token = readToken();
    if (!token) {
      alert("Please log in to report a post.");
      return;
    }

    setReportSubmitting(true);
    try {
      const response = await fetchWithTimeout(`${API_URL}/posts/${activeReportPost.id}/reports`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ reason: reportReason, details: reportDetails.trim() || null }),
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) throw new Error("Your session has expired. Please log in again.");
      if (response.status === 409) throw new Error(result.message || "You have already reported this post.");
      if (!response.ok) throw new Error(result.message || "Could not submit your report.");

      alert("Thanks. Your report has been submitted for review.");
      setActiveReportPost(null);
      setReportReason("spam");
      setReportDetails("");
    } catch (error) {
      logDev("Failed to submit report", error);
      alert(error instanceof Error ? error.message : "Could not submit your report. Please try again.");
    } finally {
      setReportSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-28 text-slate-900 lg:pb-12">
      <WelcomeScreen />
      <header className="sticky top-0 z-20 bg-white shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark size={40} className="shrink-0 rounded-xl" />
            <span className="text-xl font-extrabold tracking-tight" style={{ color: navy }}>
              Campus <span className="text-[#FF7900]">Plus</span>
            </span>
          </Link>

          <Link
            href="/notifications"
            aria-label={unread > 0 ? "Notifications, you have unread" : "Open notifications"}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-slate-100"
          >
            <Bell size={19} strokeWidth={1.8} />
            {/* A plain dot — just enough to say something is waiting. It
                renders only when there is actually something unread, so an
                empty inbox shows a clean bell. */}
            {unread > 0 && (
              <span
                aria-hidden="true"
                className="absolute right-1 top-1 h-2.5 w-2.5 rounded-full border-2 border-white"
                style={{ backgroundColor: orange }}
              />
            )}
          </Link>
        </div>

        <div className="mx-auto max-w-7xl px-4 pb-4 sm:px-6">
          <SearchBox />
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[210px_minmax(0,1fr)_290px]">
        {/* Left sidebar (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-36 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Your campus</p>
            <div className="mb-5 rounded-xl p-3" style={{ backgroundColor: "#F0F4F9" }}>
              <p className="flex items-center gap-2 font-bold" style={{ color: navy }}>
                <GraduationCap size={18} /> Select university
              </p>
              <p className="mt-1 text-xs text-slate-500">Choose your campus</p>
            </div>

            <Suspense fallback={<div className="h-64" />}>
              <SidebarNav />
            </Suspense>

            <div className="mt-6 rounded-xl p-4" style={{ backgroundColor: "#FFF3E8" }}>
              <p className="font-bold" style={{ color: navy }}>Your campus, your people.</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">
                Discover what&apos;s happening across Nigerian universities.
              </p>
            </div>
          </div>
        </aside>

        {/* Feed */}
        <section className="min-w-0 space-y-5">
          <div>
            <p className="min-h-5 text-sm font-medium text-slate-500">{today}</p>
            <h1 className="mt-1 text-2xl font-extrabold sm:text-3xl" style={{ color: navy }}>
              Your campus, your community.
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Catch up with students and discover what&apos;s happening.
            </p>
          </div>

          {/* No Feed tile here — this page is the feed. The four slots go to
              the places you cannot already see. */}
          <div className="grid grid-cols-4 gap-2">
            {[
              { Icon: Store, label: "Services", href: "/services" },
              { Icon: CalendarDays, label: "Events", href: "/events" },
              { Icon: ShoppingBag, label: "Market", href: "/market" },
              { Icon: Calculator, label: "GPA", href: "/gpa" },
            ].map(({ Icon, label, href }) => (
              <Link
                key={label}
                href={href}
                className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-1 py-4 text-xs font-semibold transition-colors hover:border-orange-200 hover:bg-orange-50"
              >
                <Icon size={22} strokeWidth={1.8} style={{ color: navy }} />
                {label}
              </Link>
            ))}
          </div>

          {/* Paid placement, labelled as such. Renders nothing at all when
              no listing is currently featured, so the home page never shows
              an empty ad box. */}
          <FeaturedServices variant="banner" services={featuredAds} />

          <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
            <div className="flex gap-3">
              <Avatar initials={me ? getInitials(me.name) : "CP"} src={me?.avatarUrl} />
              <Link
                href="/create-post"
                className="flex flex-1 items-center rounded-full bg-slate-100 px-4 py-3 text-sm text-slate-500"
              >
                What&apos;s happening on your campus?
              </Link>
            </div>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4">
              <span className="flex items-center gap-2 text-sm text-slate-500">
                <ImagePlus size={17} /> Photos or update
              </span>
              <Link
                href="/create-post"
                className="rounded-full px-5 py-2 text-sm font-bold text-[#0B1F3A]"
                style={{ backgroundColor: orange }}
              >
                Create post
              </Link>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="text-lg font-extrabold" style={{ color: navy }}>Campus feed</h2>
            <button
              type="button"
              onClick={() => void loadPosts(false)}
              disabled={refreshing || postsLoading}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold text-[#B45309] transition hover:bg-orange-50 disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} />
              {refreshing ? "Refreshing" : "Refresh"}
            </button>
          </div>

          {/* New posts arrived while you were reading. Nothing moves until
              you tap this. */}
          {waiting.length > 0 && (
            <div className="sticky top-[136px] z-30 flex justify-center">
              <button
                type="button"
                onClick={showWaiting}
                className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-slate-900/20 transition hover:-translate-y-0.5"
                style={{ backgroundColor: navy }}
              >
                <ArrowUp size={16} />
                {waiting.length} new {waiting.length === 1 ? "post" : "posts"}
              </button>
            </div>
          )}

          {postsLoading && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500">
              Loading campus posts...
            </div>
          )}

          {!postsLoading && postsError && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-white p-5 text-sm text-red-700">
              {postsError}
              <button type="button" onClick={() => void loadPosts(true)} className="ml-2 font-bold underline">
                Try again
              </button>
            </div>
          )}

          {!postsLoading && !postsError && posts.length === 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center">
              <p className="font-bold" style={{ color: navy }}>No posts yet</p>
              <p className="mt-2 text-sm text-slate-500">
                Be the first to share something with your campus community.
              </p>
              <Link
                href="/create-post"
                className="mt-4 inline-flex rounded-full px-5 py-2 text-sm font-bold text-[#0B1F3A]"
                style={{ backgroundColor: orange }}
              >
                Create the first post
              </Link>
            </div>
          )}

          {posts.map((post, index) => {
            const mine = isMine(post);
            const editable = canEditPost(post);

            // An ad after every AD_EVERY posts, but never after the last one,
            // where it would read as the end of the feed rather than a break
            // in it.
            const showAd =
              featuredAds.length > 0 &&
              (index + 1) % AD_EVERY === 0 &&
              index !== posts.length - 1;

            return (
              <Fragment key={post.id}>
                <article
                  onClick={(event) => openPost(event, post.id)}
                  className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50/50 sm:p-5"
                >
                  <div className="flex items-center gap-3">
                    <ProfileLink
                      userId={post.userId}
                      className="flex min-w-0 flex-1 items-center gap-3 rounded-lg hover:opacity-90"
                    >
                      <Avatar initials={post.initials} src={post.avatarUrl ?? myAvatar(post.userId)} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center gap-1 text-sm font-bold">
                          <span className="truncate">{post.name}</span>
                          {post.verified && <VerifiedBadge className="h-4 w-4" admin={post.adminBadge} />}

                          {/* Published to every campus, not just this one.
                              Without it an announcement looks like it came
                              from one student at your own school. */}
                          {post.platformWide && (
                            <span
                              className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600"
                              title="Posted to every school on Campus Plus"
                            >
                              <Globe2 size={10} aria-hidden="true" />
                              All schools
                            </span>
                          )}
                        </p>
                        <p className="truncate text-xs text-slate-500">
                          {post.school} · {timeAgo(post.createdAt)}{post.edited ? " · edited" : ""}
                        </p>
                      </div>
                    </ProfileLink>

                    <div className="relative" data-post-menu>
                      <button
                        type="button"
                        aria-label={`More options for ${post.name}`}
                        aria-haspopup="menu"
                        aria-expanded={openPostMenuId === post.id}
                        onClick={() => setOpenPostMenuId((current) => (current === post.id ? null : post.id))}
                        className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                      >
                        <MoreHorizontal size={18} />
                      </button>

                      {openPostMenuId === post.id && (
                        <div
                          role="menu"
                          className="absolute right-0 top-full z-30 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1 shadow-lg"
                        >
                          {mine && editable && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => startEdit(post)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-700"
                            >
                              <SquarePen size={16} /> Edit post
                            </button>
                          )}

                          {mine && !editable && (
                            <p className="px-3 py-2 text-xs leading-5 text-slate-400">
                              The 5-minute edit window has closed.
                            </p>
                          )}

                          {mine && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => void deletePost(post)}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-red-700 hover:bg-red-50"
                            >
                              <Trash2 size={16} /> Delete post
                            </button>
                          )}

                          {!mine && (
                            <button
                              type="button"
                              role="menuitem"
                              onClick={() => {
                                setOpenPostMenuId(null);
                                setActiveReportPost(post);
                                setReportReason("spam");
                                setReportDetails("");
                              }}
                              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-slate-700 hover:bg-orange-50 hover:text-orange-700"
                            >
                              <Flag size={16} /> Report post
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <p className="my-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                    {post.text}
                  </p>

                  {/* lightbox off in the feed: tapping a photo opens the post,
                      the same as tapping anywhere else on the card. */}
                  <PostImages paths={post.imagePaths} lightbox={false} />

                  <div className="flex flex-wrap gap-x-5 gap-y-3 border-t border-slate-100 pt-4 text-sm text-slate-600">
                    <button
                      type="button"
                      aria-label={post.likedByMe ? "Unlike post" : "Like post"}
                      aria-pressed={post.likedByMe}
                      disabled={post.likeBusy}
                      onClick={() => void handleToggleLike(post.id)}
                      className={`inline-flex items-center gap-2 transition-colors disabled:opacity-50 ${
                        post.likedByMe ? "font-semibold text-orange-600" : "hover:text-orange-600"
                      }`}
                    >
                      <Heart size={18} strokeWidth={1.8} fill={post.likedByMe ? "currentColor" : "none"} />
                      Likes{post.likesCount > 0 ? ` ${post.likesCount}` : ""}
                    </button>

                    {/* A real link, so it works with the keyboard, can be opened
                        in a new tab, and is ignored by the card's own click. */}
                    <Link
                      href={`/post/${post.id}`}
                      className="inline-flex items-center gap-2 hover:text-[#0B1F3A]"
                      aria-label={`Open comments on ${post.name}'s post`}
                    >
                      <MessageCircle size={18} strokeWidth={1.8} />
                      Comments{post.commentsCount > 0 ? ` ${post.commentsCount}` : ""}
                    </Link>
                  </div>
                </article>

                {showAd && (
                  <FeaturedAd services={featuredAds} slot={Math.floor(index / AD_EVERY)} />
                )}
              </Fragment>
            );
          })}
        </section>

        {/* Right column */}
        <aside className="space-y-5">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-extrabold" style={{ color: navy }}>Upcoming events</h2>
              <Link href="/events" className="text-xs font-bold text-[#B45309]">See all</Link>
            </div>
            <div className="space-y-4">
              {eventsLoading ? (
                <p className="py-3 text-sm text-slate-500">Loading upcoming events...</p>
              ) : events.length === 0 ? (
                <p className="py-3 text-sm text-slate-500">No upcoming events yet.</p>
              ) : (
                events.map((event) => (
                  <article key={event.id} className="flex gap-3">
                    <div
                      className="flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl"
                      style={{ backgroundColor: "#FFF3E8", color: navy }}
                    >
                      <span className="text-xl font-extrabold">{event.day}</span>
                      <span className="text-xs font-bold text-[#B45309]">{event.month}</span>
                    </div>
                    <div>
                      <h3 className="text-sm font-bold">{event.title}</h3>
                      <p className="mt-1 text-xs leading-5 text-slate-500">{event.place}</p>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          {/* Services. Sits above the marketplace card because a barber or
              tailor is something students look for far more often than a
              second-hand laptop. */}
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-extrabold" style={{ color: navy }}>Student services</h2>
                <p className="mt-1 text-xs text-slate-500">Barbers, tailors, food, laundry and more.</p>
              </div>
              <Link
                href="/services"
                className="shrink-0 rounded-full px-4 py-2 text-sm font-bold text-[#0B1F3A]"
                style={{ backgroundColor: orange }}
              >
                Browse
              </Link>
            </div>
            <Link
              href="/services/new"
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:border-orange-200 hover:bg-orange-50"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ color: orange, backgroundColor: "#FFF3E8" }}
              >
                <Store size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold" style={{ color: navy }}>Run a business?</span>
                <span className="mt-1 block text-xs text-slate-500">List it free and let students find you.</span>
              </span>
              <ArrowRight size={18} className="shrink-0 text-[#B45309]" aria-hidden="true" />
            </Link>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="font-extrabold" style={{ color: navy }}>Student marketplace</h2>
                <p className="mt-1 text-xs text-slate-500">Buy and sell with students on your campus.</p>
              </div>
              <Link
                href="/market"
                className="shrink-0 rounded-full px-4 py-2 text-sm font-bold text-[#0B1F3A]"
                style={{ backgroundColor: orange }}
              >
                Open marketplace
              </Link>
            </div>
            <Link
              href="/market"
              className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-4 transition hover:border-orange-200 hover:bg-orange-50"
            >
              <span
                className="flex h-11 w-11 items-center justify-center rounded-xl"
                style={{ color: orange, backgroundColor: "#FFF3E8" }}
              >
                <ShoppingBag size={22} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block font-bold" style={{ color: navy }}>Browse student listings</span>
                <span className="mt-1 block text-xs text-slate-500">Explore products and message sellers.</span>
              </span>
              <ArrowRight size={18} className="shrink-0 text-[#B45309]" aria-hidden="true" />
            </Link>
          </section>

          <section className="rounded-2xl p-5 text-white" style={{ backgroundColor: navy }}>
            <p className="text-lg font-extrabold">Discover more campuses</p>
            <p className="mt-2 text-sm leading-6 text-slate-200">
              See public posts, events, and student businesses from other universities.
            </p>
            <span
              className="mt-4 inline-flex cursor-not-allowed rounded-full px-4 py-2 text-sm font-bold text-[#0B1F3A]"
              style={{ backgroundColor: orange }}
            >
              Coming soon
            </span>
          </section>
        </aside>
      </div>

      {/* Edit post modal */}
      {editingPost && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !editSaving) setEditingPost(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-post-title"
            className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
          >
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h2 id="edit-post-title" className="font-extrabold" style={{ color: navy }}>Edit post</h2>
                <p className="mt-1 text-sm text-slate-500">You can edit for 5 minutes after posting.</p>
              </div>
              <button
                type="button"
                aria-label="Close editor"
                disabled={editSaving}
                onClick={() => setEditingPost(null)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </header>

            <form onSubmit={saveEdit} className="space-y-4">
              <div>
                <label htmlFor="edit-post-text" className="sr-only">Post text</label>
                <textarea
                  id="edit-post-text"
                  autoFocus
                  rows={6}
                  maxLength={5000}
                  value={editText}
                  onChange={(event) => setEditText(event.target.value)}
                  className="w-full resize-y rounded-xl border border-slate-200 px-4 py-3 text-base outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 sm:text-sm"
                />
                <p className="mt-1 text-right text-xs text-slate-500">{editText.length}/5000</p>
              </div>

              {editingPost.imagePaths.length > 0 && (
                <p className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                  {editingPost.imagePaths.length === 1
                    ? "The photo stays as it is. To change it, delete the post and share it again."
                    : "The photos stay as they are. To change them, delete the post and share it again."}
                </p>
              )}

              {editError && (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
                  {editError}
                </p>
              )}

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  disabled={editSaving}
                  onClick={() => setEditingPost(null)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving || !editText.trim()}
                  className="rounded-full px-5 py-2 text-sm font-bold text-[#0B1F3A] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: orange }}
                >
                  {editSaving ? "Saving..." : "Save changes"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      {/* Report modal */}
      {activeReportPost && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !reportSubmitting) setActiveReportPost(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="report-post-title"
            className="w-full max-w-lg rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
          >
            <header className="mb-4 flex items-center justify-between">
              <div>
                <h2 id="report-post-title" className="font-extrabold" style={{ color: navy }}>Report post</h2>
                <p className="mt-1 text-sm text-slate-500">Tell us why this post should be reviewed.</p>
              </div>
              <button
                type="button"
                aria-label="Close report form"
                disabled={reportSubmitting}
                onClick={() => setActiveReportPost(null)}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"
              >
                <X size={19} />
              </button>
            </header>

            <p className="mb-4 line-clamp-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-600">
              {activeReportPost.text}
            </p>

            <form onSubmit={submitPostReport} className="space-y-4">
              <div>
                <label htmlFor="report-reason" className="mb-1 block text-sm font-semibold text-slate-700">
                  Reason for report
                </label>
                <select
                  id="report-reason"
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-base outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 sm:text-sm"
                >
                  <option value="spam">Spam</option>
                  <option value="harassment">Harassment or bullying</option>
                  <option value="inappropriate_content">Inappropriate content</option>
                  <option value="misinformation">False or misleading information</option>
                  <option value="other">Other</option>
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
                  placeholder="Add details to help our team review this report..."
                  className="w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 sm:text-sm"
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  disabled={reportSubmitting}
                  onClick={() => setActiveReportPost(null)}
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reportSubmitting}
                  className="rounded-full px-5 py-2 text-sm font-bold text-[#0B1F3A] disabled:cursor-not-allowed disabled:opacity-50"
                  style={{ backgroundColor: orange }}
                >
                  {reportSubmitting ? "Submitting..." : "Submit report"}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}

      <BottomNav />
    </main>
  );
}