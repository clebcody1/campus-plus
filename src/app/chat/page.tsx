"use client";

import {
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCheck,
  GraduationCap,
  Home as HomeIcon,
  MessageCircle,
  Plus,
  Search,
  Send,
  ShoppingBag,
  Trash2,
  UserRound,
  X,
} from "lucide-react";

import BottomNav from "@/components/BottomNav";
import BrandMark from "@/components/BrandMark";
import { API_URL, storageUrl } from "@/lib/api";

const navy = "#0B1F3A";
const orange = "#FF7900";

/** How tall the message box is allowed to grow before it scrolls inside itself. */
const COMPOSER_MAX_HEIGHT = 160;

/* ───────────── Types ───────────── */

type Person = {
  id?: number | string;
  name?: string;
  username?: string | null;
  avatar_path?: string | null;
  university?: string | null;
  is_verified?: boolean;
  role?: string;
};

type Listing = {
  id: number | string;
  title: string;
  price?: number | string | null;
};

type ChatMessage = {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  read_at: string | null;
  created_at: string;
};

type Conversation = {
  id: number;
  type?: string;
  listing_id: number | null;
  buyer_id: number;
  seller_id: number;
  listing?: Listing;
  buyer?: Person;
  seller?: Person;
  messages?: ChatMessage[];
  unread_count?: number;
};

type Me = { id: number; name: string; avatarUrl: string | null };

type Paginated<T> = { data?: T[] };

/* ───────────── Helpers ───────────── */

function getToken() {
  return typeof window !== "undefined"
    ? window.localStorage.getItem("campus_life_token")
    : null;
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
    if (response.status === 401) throw new Error("Please log in to use chat.");
    if (response.status === 419) throw new Error("Your session expired. Please log in again.");
    throw new Error(result.message || `Request failed (HTTP ${response.status}).`);
  }

  return result as T;
}

function formatNaira(value?: number | string | null) {
  if (value === null || value === undefined || value === "") return "";
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0,
      }).format(amount)
    : `₦${value}`;
}

function sameDay(a: Date, b: Date) {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function listTime(dateString?: string) {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  if (sameDay(date, now)) {
    return date.toLocaleTimeString("en-NG", { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-NG", { day: "numeric", month: "short" });
}

function dayLabel(dateString: string) {
  const date = new Date(dateString);
  const now = new Date();
  if (sameDay(date, now)) return "Today";
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (sameDay(date, yesterday)) return "Yesterday";
  return date.toLocaleDateString("en-NG", { weekday: "short", day: "numeric", month: "short" });
}

function initialOf(name: string) {
  return (name.trim().charAt(0) || "S").toUpperCase();
}

const isMarketplace = (item: Conversation) => Boolean(item.listing_id || item.listing);

type Tab = "all" | "direct" | "marketplace";

// A student's profile picture, or their first initial if they have none.
function PersonAvatar({
  name,
  src,
  className = "h-12 w-12",
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-100 font-bold text-orange-700 ${className}`}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        initialOf(name)
      )}
    </div>
  );
}

// Opens a student's profile. Falls back to a plain box when there's no id.
function ProfileLink({
  userId,
  label,
  className,
  children,
}: {
  userId?: number | string | null;
  label?: string;
  className?: string;
  children: ReactNode;
}) {
  if (!userId) return <div className={className}>{children}</div>;
  return (
    <Link href={`/users/${userId}`} aria-label={label} className={className}>
      {children}
    </Link>
  );
}

/* ───────────── Swipe to delete ─────────────
   Swipe a chat in the list to the left to reveal a delete button. Keep
   swiping past the threshold and release to delete it. Release earlier and
   it snaps open (tap the trash icon to delete) or closed. */

const REVEAL_WIDTH = 76; // how far the row rests open
const DELETE_THRESHOLD = 160; // pull past this and release to delete
const MAX_PULL = 240;

function SwipeToDelete({
  children,
  onDelete,
  label = "Delete",
}: {
  children: ReactNode;
  onDelete: () => void;
  label?: string;
}) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);
  const start = useRef<{ x: number; y: number; base: number } | null>(null);
  const horizontal = useRef(false);
  const justDragged = useRef(false);

  function triggerDelete() {
    if (leaving) return;
    setLeaving(true);
    setDragging(false);
    setOffset(-(wrapperRef.current?.offsetWidth ?? 480));
    window.setTimeout(onDelete, 200);
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (leaving) return;
    if (event.pointerType === "mouse" && event.button !== 0) return;
    start.current = { x: event.clientX, y: event.clientY, base: offset };
    horizontal.current = false;
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    const origin = start.current;
    if (!origin || leaving) return;

    const dx = event.clientX - origin.x;
    const dy = event.clientY - origin.y;

    // Only take over once it's clearly a sideways swipe, so vertical scrolling still works.
    if (!horizontal.current) {
      if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
      horizontal.current = true;
      setDragging(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }

    setOffset(Math.min(0, Math.max(-MAX_PULL, origin.base + dx)));
  }

  function handlePointerEnd() {
    start.current = null;
    if (!horizontal.current) return;

    horizontal.current = false;
    justDragged.current = true;
    window.setTimeout(() => {
      justDragged.current = false;
    }, 60);
    setDragging(false);

    if (offset <= -DELETE_THRESHOLD) triggerDelete();
    else if (offset <= -REVEAL_WIDTH / 2) setOffset(-REVEAL_WIDTH);
    else setOffset(0);
  }

  const pulled = -offset;
  const armed = pulled >= DELETE_THRESHOLD && !leaving;
  const progress = Math.min(1, pulled / REVEAL_WIDTH);

  return (
    <div ref={wrapperRef} className="relative overflow-hidden rounded-xl">
      {/* Delete action revealed behind the row */}
      <div
        aria-hidden={pulled === 0}
        className="absolute inset-y-0 right-0 flex items-center overflow-hidden rounded-xl"
        style={{
          width: pulled,
          backgroundColor: armed ? "#DC2626" : "#EF4444",
          transition: dragging ? "none" : "width 200ms ease-out, background-color 150ms",
        }}
      >
        <button
          type="button"
          onClick={triggerDelete}
          aria-label={label}
          tabIndex={pulled >= REVEAL_WIDTH - 4 ? 0 : -1}
          className="flex h-full shrink-0 items-center justify-center text-white"
          style={{
            width: REVEAL_WIDTH,
            opacity: progress,
            transform: `scale(${armed ? 1.25 : 0.7 + progress * 0.3})`,
            transition: "transform 150ms",
          }}
        >
          <Trash2 size={20} />
        </button>
      </div>

      {/* The row itself */}
      <div
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerEnd}
        onPointerCancel={handlePointerEnd}
        onClickCapture={(event) => {
          // A tap on an opened row closes it; a drag release should do nothing.
          if (justDragged.current) {
            event.stopPropagation();
            return;
          }
          if (offset < 0 && !leaving) {
            event.stopPropagation();
            setOffset(0);
          }
        }}
        className={`touch-pan-y bg-white ${dragging ? "select-none" : ""}`}
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? "none" : "transform 200ms ease-out",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ───────────── Sidebar (desktop) ───────────── */

const navigationItems = [
  { label: "Home", href: "/" },
  { label: "Events", href: "/events" },
  { label: "Chat", href: "/chat" },
  { label: "Market", href: "/market" },
  { label: "Profile", href: "/profile" },
] as const;

const footerIcons = {
  home: HomeIcon,
  events: CalendarDays,
  chat: MessageCircle,
  market: ShoppingBag,
  profile: UserRound,
} as const;

const iconNames = {
  Home: "home",
  Events: "events",
  Chat: "chat",
  Market: "market",
  Profile: "profile",
} as const;

function FooterIcon({ name }: { name: keyof typeof footerIcons }) {
  const Icon = footerIcons[name];
  return <Icon size={20} strokeWidth={1.8} aria-hidden="true" />;
}

function SidebarNav() {
  const pathname = usePathname();

  return (
    <nav className="space-y-2" aria-label="Campus sections">
      {navigationItems.map(({ label, href }) => {
        const active =
          href === "/"
            ? pathname === "/"
            : pathname === href || pathname.startsWith(`${href}/`);
        const isChat = label === "Chat";
        const desktopLabel =
          label === "Market" ? "Marketplace" : label === "Profile" ? "My profile" : label;
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
            className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${
              active ? "text-white" : "text-slate-600 hover:bg-slate-50"
            }`}
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

/* ───────────── Page ───────────── */

export default function ChatPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [me, setMe] = useState<Me | null>(null);
  const currentUserId = me?.id ?? null;

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxError, setInboxError] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState<Tab>("all");

  const [newChatOpen, setNewChatOpen] = useState(false);
  const [userQuery, setUserQuery] = useState("");
  const [userResults, setUserResults] = useState<Person[]>([]);
  const [userSearching, setUserSearching] = useState(false);
  const [startingId, setStartingId] = useState<number | string | null>(null);
  const [newChatError, setNewChatError] = useState("");
  const [openError, setOpenError] = useState("");
  const handledUserParam = useRef(false);

  const [activeId, setActiveId] = useState<number | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [messageText, setMessageText] = useState("");
  const [sending, setSending] = useState(false);
  const [threadError, setThreadError] = useState("");

  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  // Chats being deleted: kept out of the list even if a poll returns them before the server finishes.
  const pendingChatDeletes = useRef<Set<number>>(new Set());

  /* Who am I? The server's answer wins, so signing in as a different student
     on the same device can never mix up whose messages are whose. */
  useEffect(() => {
    const token = getToken();
    if (!token) {
      setAuthed(false);
      setInboxLoading(false);
      return;
    }
    setAuthed(true);

    // Show the saved copy straight away...
    try {
      const raw = window.localStorage.getItem("campus_life_user");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Number.isFinite(Number(parsed.id))) {
        setMe({
          id: Number(parsed.id),
          name: String(parsed.name ?? "You"),
          avatarUrl: storageUrl(parsed.avatar_path),
        });
      }
    } catch {
      // Ignore a corrupt cached user.
    }

    // ...then confirm with the server.
    let cancelled = false;
    apiRequest<{ user?: Person & { id?: number }; id?: number }>("/user")
      .then((result) => {
        const user = (result.user ?? result) as Person;
        const id = Number(user.id);
        if (!cancelled && Number.isFinite(id)) {
          setMe({ id, name: user.name ?? "You", avatarUrl: storageUrl(user.avatar_path) });
        }
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  /* Inbox */
  const loadInbox = useCallback(async () => {
    try {
      const result = await apiRequest<Paginated<Conversation> | Conversation[]>("/conversations");
      const rows = Array.isArray(result) ? result : result.data ?? [];
      setConversations(rows.filter((item) => !pendingChatDeletes.current.has(item.id)));
      setInboxError("");
    } catch (e) {
      setInboxError(e instanceof Error ? e.message : "Could not load your chats.");
    } finally {
      setInboxLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    loadInbox();
    const interval = window.setInterval(loadInbox, 10000);
    return () => window.clearInterval(interval);
  }, [authed, loadInbox]);

  /* Messages for the open conversation */
  const loadMessages = useCallback(async (conversationId: number) => {
    const result = await apiRequest<Paginated<ChatMessage> | ChatMessage[]>(
      `/conversations/${conversationId}/messages`
    );
    const rows = Array.isArray(result) ? result : result.data ?? [];
    setMessages(rows);

    try {
      await apiRequest(`/conversations/${conversationId}/read`, { method: "PATCH" });
      setConversations((current) =>
        current.map((item) => (item.id === conversationId ? { ...item, unread_count: 0 } : item))
      );
    } catch {
      // The thread still works if the read receipt fails.
    }
  }, []);

  useEffect(() => {
    if (activeId === null) return;

    let cancelled = false;
    setMessages([]);
    setThreadError("");
    setMessagesLoading(true);

    loadMessages(activeId)
      .catch((e) => {
        if (!cancelled) setThreadError(e instanceof Error ? e.message : "Could not load messages.");
      })
      .finally(() => {
        if (!cancelled) setMessagesLoading(false);
      });

    const interval = window.setInterval(() => {
      loadMessages(activeId).catch(() => {});
    }, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeId, loadMessages]);

  /* Keep the newest message in view */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length, activeId]);

  /* The message box grows with what you type.
     A textarea has a fixed height unless something resizes it: measure the
     content, then set the height to match, capped so a long message scrolls
     inside the box rather than swallowing the conversation. Resetting to
     "auto" first is what lets it shrink again when you delete text. */
  useEffect(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT)}px`;
  }, [messageText, activeId]);

  /* Derived */
  // The other student in a chat.
  const personOf = useCallback(
    (item: Conversation): Person | undefined =>
      currentUserId === item.seller_id ? item.buyer : item.seller,
    [currentUserId]
  );

  const partnerOf = useCallback(
    (item: Conversation) => personOf(item)?.name || "Campus Plus student",
    [personOf]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();

    return conversations.filter((item) => {
      if (tab === "direct" && isMarketplace(item)) return false;
      if (tab === "marketplace" && !isMarketplace(item)) return false;
      if (!q) return true;
      return [partnerOf(item), item.listing?.title].some((value) =>
        String(value ?? "").toLocaleLowerCase().includes(q)
      );
    });
  }, [conversations, search, tab, partnerOf]);

  const active = conversations.find((item) => item.id === activeId) ?? null;
  const partner = active ? personOf(active) : undefined;
  const partnerName = active ? partnerOf(active) : "";
  const partnerAvatar = storageUrl(partner?.avatar_path);

  const unreadWhere = (test: (item: Conversation) => boolean) =>
    conversations.filter(test).reduce((sum, item) => sum + (item.unread_count ?? 0), 0);
  const directUnread = unreadWhere((item) => !isMarketplace(item));
  const marketUnread = unreadWhere(isMarketplace);

  /* New chat: search students, then open (or create) a direct conversation */
  useEffect(() => {
    if (!newChatOpen) return;
    const q = userQuery.trim();
    if (q.length < 2) {
      setUserResults([]);
      setUserSearching(false);
      return;
    }

    let cancelled = false;
    setUserSearching(true);
    const timeout = window.setTimeout(async () => {
      try {
        const result = await apiRequest<Paginated<Person> | Person[]>(
          `/users/search?q=${encodeURIComponent(q)}`
        );
        const rows = Array.isArray(result) ? result : result.data ?? [];
        if (!cancelled) {
          setUserResults(rows.filter((user) => Number(user.id) !== currentUserId));
          setNewChatError("");
        }
      } catch (e) {
        if (!cancelled) setNewChatError(e instanceof Error ? e.message : "Could not search students.");
      } finally {
        if (!cancelled) setUserSearching(false);
      }
    }, 300);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [userQuery, newChatOpen, currentUserId]);

  /* Arriving from a student's profile: /chat?user=<id> opens the existing chat
     with them, or starts a new one. Waits until we know who "me" is so the
     other person's name shows correctly. */
  useEffect(() => {
    if (!authed || currentUserId === null || handledUserParam.current) return;
    handledUserParam.current = true;

    const raw = new URLSearchParams(window.location.search).get("user");
    if (!raw) return;

    // Remove the parameter so a refresh doesn't repeat this.
    window.history.replaceState(null, "", "/chat");

    const targetId = Number(raw);
    if (!Number.isInteger(targetId) || targetId < 1) return;

    (async () => {
      try {
        setOpenError("");
        const result = await apiRequest<{ conversation: Conversation }>("/conversations/direct", {
          method: "POST",
          body: JSON.stringify({ user_id: targetId }),
        });
        const created = result.conversation;
        pendingChatDeletes.current.delete(created.id);
        setConversations((current) =>
          current.some((item) => item.id === created.id) ? current : [created, ...current]
        );
        setTab("all");
        setSearch("");
        setActiveId(created.id);
      } catch (e) {
        setOpenError(e instanceof Error ? e.message : "Could not open that chat.");
      }
    })();
  }, [authed, currentUserId]);

  function closeNewChat() {
    setNewChatOpen(false);
    setUserQuery("");
    setUserResults([]);
    setNewChatError("");
  }

  async function startDirectChat(user: Person) {
    if (user.id === undefined || startingId !== null) return;
    try {
      setStartingId(user.id);
      setNewChatError("");
      const result = await apiRequest<{ conversation: Conversation }>("/conversations/direct", {
        method: "POST",
        body: JSON.stringify({ user_id: user.id }),
      });
      const created = result.conversation;
      pendingChatDeletes.current.delete(created.id);
      setConversations((current) =>
        current.some((item) => item.id === created.id) ? current : [created, ...current]
      );
      setTab("all");
      setSearch("");
      setActiveId(created.id);
      closeNewChat();
    } catch (e) {
      setNewChatError(e instanceof Error ? e.message : "Could not start the chat.");
    } finally {
      setStartingId(null);
    }
  }

  async function sendMessage() {
    const body = messageText.trim();
    if (activeId === null || !body || sending) return;

    try {
      setSending(true);
      setThreadError("");
      await apiRequest(`/conversations/${activeId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
      setMessageText("");
      await loadMessages(activeId);
      loadInbox();
    } catch (e) {
      setThreadError(e instanceof Error ? e.message : "Could not send your message.");
    } finally {
      setSending(false);
    }
  }

  /* Delete a whole chat (removes it from your list; the other person keeps theirs). */
  async function deleteConversation(conversationId: number) {
    pendingChatDeletes.current.add(conversationId);
    setConversations((current) => current.filter((item) => item.id !== conversationId));
    if (activeId === conversationId) {
      setActiveId(null);
      setMessages([]);
    }
    setOpenError("");

    try {
      await apiRequest(`/conversations/${conversationId}`, { method: "DELETE" });
    } catch (e) {
      // The server refused, so let the chat come back on the next refresh.
      pendingChatDeletes.current.delete(conversationId);
      setOpenError(e instanceof Error ? e.message : "Could not delete that chat.");
      loadInbox();
    }
  }

  /* Panel height: leaves room for the header (and the bottom nav on the list view). */
  const panelHeight = activeId !== null
    ? "h-[calc(100dvh-65px-32px)]"
    : "h-[calc(100dvh-65px-32px-84px)]";

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white shadow-sm">
        <div className="mx-auto flex h-[65px] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="flex items-center gap-2" aria-label="Campus Plus home">
            <BrandMark size={40} className="shrink-0 rounded-xl" />
            <span className="text-xl font-extrabold tracking-tight" style={{ color: navy }}>
              Campus <span className="text-[#FF7900]">Plus</span>
            </span>
          </Link>

          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100"
          >
            <ArrowLeft size={17} />
            <span className="hidden sm:inline">Back to feed</span>
            <span className="sm:hidden">Back</span>
          </Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-4 sm:px-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:py-6">
        {/* Left sidebar (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 rounded-2xl border border-slate-200 bg-white p-4">
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

        {/* Chat panel */}
        <section
          aria-label="Chat"
          className={`min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white lg:grid lg:h-[calc(100dvh-65px-48px)] lg:grid-cols-[340px_minmax(0,1fr)] ${panelHeight}`}
        >
          {/* Conversation list */}
          <div
            className={`min-h-0 flex-col border-slate-200 lg:flex lg:border-r ${
              activeId !== null ? "hidden" : "flex"
            } h-full`}
          >
            <div className="border-b border-slate-100 p-4">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-xl font-extrabold" style={{ color: navy }}>Chats</h1>
                <button
                  type="button"
                  onClick={() => {
                    if (authed === false) return;
                    setNewChatOpen(true);
                  }}
                  disabled={authed === false}
                  className="inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold text-[#0B1F3A] transition hover:opacity-90 disabled:opacity-50"
                  style={{ backgroundColor: orange }}
                >
                  <Plus size={16} /> New chat
                </button>
              </div>

              <div role="tablist" aria-label="Chat type" className="mt-3 flex gap-1 rounded-xl bg-slate-100 p-1">
                {(
                  [
                    { id: "all", label: "All", unread: directUnread + marketUnread },
                    { id: "direct", label: "Direct", unread: directUnread },
                    { id: "marketplace", label: "Marketplace", unread: marketUnread },
                  ] as { id: Tab; label: string; unread: number }[]
                ).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    role="tab"
                    aria-selected={tab === item.id}
                    onClick={() => setTab(item.id)}
                    className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg px-2 py-2 text-xs font-bold transition sm:text-sm ${
                      tab === item.id ? "bg-white text-[#0B1F3A] shadow-sm" : "text-slate-500 hover:text-[#0B1F3A]"
                    }`}
                  >
                    {item.label}
                    {item.unread > 0 && (
                      <span
                        className="flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                        style={{ backgroundColor: orange, color: navy }}
                      >
                        {item.unread}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <label className="mt-3 flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5">
                <Search size={17} className="shrink-0 text-slate-500" aria-hidden="true" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search chats..."
                  aria-label="Search chats"
                  className="w-full bg-transparent text-base outline-none placeholder:text-slate-500 sm:text-sm"
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-2">
              {openError && (
                <p role="alert" className="m-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                  {openError}
                </p>
              )}
              {authed === false ? (
                <div className="px-4 py-12 text-center">
                  <MessageCircle size={30} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm font-semibold" style={{ color: navy }}>Log in to see your chats</p>
                  <Link
                    href="/login"
                    className="mt-4 inline-flex rounded-full px-5 py-2 text-sm font-bold text-[#0B1F3A]"
                    style={{ backgroundColor: orange }}
                  >
                    Log in
                  </Link>
                </div>
              ) : inboxLoading ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3, 4].map((n) => (
                    <div key={n} className="flex items-center gap-3 p-2">
                      <div className="h-12 w-12 animate-pulse rounded-full bg-slate-100" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                        <div className="h-3 w-3/4 animate-pulse rounded bg-slate-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : inboxError ? (
                <div role="alert" className="m-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                  {inboxError}
                  <button type="button" onClick={loadInbox} className="ml-2 font-bold underline">
                    Try again
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <MessageCircle size={30} className="mx-auto text-slate-300" />
                  <p className="mt-3 text-sm font-semibold" style={{ color: navy }}>
                    {search ? "No matching chats" : "No chats yet"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {search
                      ? "Try a different name or item."
                      : tab === "marketplace"
                        ? "Message a seller from the marketplace to start a conversation."
                        : "Start a chat with any student on Campus Plus."}
                  </p>
                  {!search && (
                    tab === "marketplace" ? (
                      <Link
                        href="/market"
                        className="mt-4 inline-flex rounded-full px-5 py-2 text-sm font-bold text-[#0B1F3A]"
                        style={{ backgroundColor: orange }}
                      >
                        Browse marketplace
                      </Link>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setNewChatOpen(true)}
                        className="mt-4 inline-flex rounded-full px-5 py-2 text-sm font-bold text-[#0B1F3A]"
                        style={{ backgroundColor: orange }}
                      >
                        Start a chat
                      </button>
                    )
                  )}
                </div>
              ) : (
                <div className="space-y-1">
                  {filtered.map((item) => {
                    const name = partnerOf(item);
                    const last = item.messages?.[item.messages.length - 1];
                    const isActive = item.id === activeId;
                    const unread = item.unread_count ?? 0;

                    return (
                      <SwipeToDelete
                        key={item.id}
                        label={`Delete chat with ${name}`}
                        onDelete={() => void deleteConversation(item.id)}
                      >
                        <button
                          type="button"
                          onClick={() => setActiveId(item.id)}
                          aria-current={isActive ? "true" : undefined}
                          className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition ${
                            isActive ? "bg-orange-50" : "hover:bg-slate-50"
                          }`}
                        >
                          <PersonAvatar name={name} src={storageUrl(personOf(item)?.avatar_path)} />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-2">
                              <p className={`truncate text-sm ${unread ? "font-extrabold" : "font-bold"}`}>{name}</p>
                              <span className="shrink-0 text-xs text-slate-500">{listTime(last?.created_at)}</span>
                            </div>
                            {item.listing?.title && (
                              <p className="flex items-center gap-1 truncate text-xs font-semibold text-[#B45309]">
                                <ShoppingBag size={12} className="shrink-0" aria-hidden="true" />
                                <span className="truncate">{item.listing.title}</span>
                              </p>
                            )}
                            <p
                              className={`flex items-center gap-1 truncate text-sm ${
                                unread ? "font-semibold text-slate-800" : "text-slate-500"
                              }`}
                            >
                              {last && currentUserId !== null && last.sender_id === currentUserId &&
                                (last.read_at ? (
                                  <CheckCheck size={14} strokeWidth={2.5} role="img" aria-label="Read" className="shrink-0 text-[#FF7900]" />
                                ) : (
                                  <Check size={14} strokeWidth={2.5} role="img" aria-label="Sent" className="shrink-0" />
                                ))}
                              <span className="truncate">{last?.body || "Open conversation"}</span>
                            </p>
                          </div>
                          {unread > 0 && (
                            <span
                              className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold"
                              style={{ backgroundColor: orange, color: navy }}
                            >
                              {unread}
                            </span>
                          )}
                        </button>
                      </SwipeToDelete>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Thread */}
          <div
            className={`min-h-0 min-w-0 flex-col lg:flex ${activeId !== null ? "flex" : "hidden"} h-full`}
          >
            {!active ? (
              <div className="flex h-full flex-col items-center justify-center px-6 text-center">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-orange-50">
                  <MessageCircle size={30} className="text-[#FF7900]" />
                </div>
                <h2 className="mt-4 text-lg font-extrabold" style={{ color: navy }}>Select a chat</h2>
                <p className="mt-1 max-w-xs text-sm text-slate-500">
                  Pick a conversation on the left to read and reply to messages.
                </p>
              </div>
            ) : (
              <>
                {/* Thread header */}
                <div className="flex items-center gap-3 border-b border-slate-100 px-3 py-3 sm:px-4">
                  <button
                    type="button"
                    onClick={() => setActiveId(null)}
                    aria-label="Back to chats"
                    className="rounded-full p-2 text-slate-600 hover:bg-slate-100 lg:hidden"
                  >
                    <ArrowLeft size={20} />
                  </button>

                  <ProfileLink
                    userId={partner?.id}
                    label={`View ${partnerName}'s profile`}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg hover:opacity-90"
                  >
                    <PersonAvatar name={partnerName} src={partnerAvatar} className="h-10 w-10" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-extrabold" style={{ color: navy }}>{partnerName}</p>
                      <p className="truncate text-xs text-slate-500">
                        {partner?.username ? `@${partner.username}` : "View profile"}
                      </p>
                    </div>
                  </ProfileLink>

                  {active.listing && (
                    <Link
                      href={`/market/${active.listing.id}`}
                      className="hidden max-w-[40%] shrink-0 truncate rounded-full bg-orange-50 px-3 py-1.5 text-xs font-semibold text-[#B45309] hover:bg-orange-100 sm:block"
                    >
                      {active.listing.title}
                      {active.listing.price != null && active.listing.price !== ""
                        ? ` · ${formatNaira(active.listing.price)}`
                        : ""}
                    </Link>
                  )}
                </div>

                {/* Messages */}
                <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain bg-slate-50 p-4">
                  {messagesLoading && messages.length === 0 ? (
                    <p className="py-10 text-center text-sm text-slate-500">Opening conversation...</p>
                  ) : messages.length === 0 ? (
                    <div className="py-10 text-center">
                      <p className="font-semibold text-slate-700">Start the conversation</p>
                      <p className="mt-1 text-sm text-slate-500">Say hello and agree on a safe campus pickup.</p>
                    </div>
                  ) : currentUserId === null ? (
                    <p className="py-10 text-center text-sm text-slate-500">Loading messages...</p>
                  ) : (
                    messages.map((message, index) => {
                      const isMine = message.sender_id === currentUserId;
                      const previous = messages[index - 1];
                      const next = messages[index + 1];
                      const showDay =
                        !previous || !sameDay(new Date(previous.created_at), new Date(message.created_at));
                      // The picture sits beside the last message of each run from the same person.
                      const lastInRun =
                        !next ||
                        next.sender_id !== message.sender_id ||
                        !sameDay(new Date(next.created_at), new Date(message.created_at));

                      const avatar = !lastInRun ? (
                        <div className="h-8 w-8 shrink-0" aria-hidden="true" />
                      ) : isMine ? (
                        <Link href="/profile" aria-label="Your profile" className="shrink-0">
                          <PersonAvatar name={me?.name ?? "You"} src={me?.avatarUrl} className="h-8 w-8 text-xs" />
                        </Link>
                      ) : (
                        <ProfileLink
                          userId={partner?.id}
                          label={`View ${partnerName}'s profile`}
                          className="shrink-0"
                        >
                          <PersonAvatar name={partnerName} src={partnerAvatar} className="h-8 w-8 text-xs" />
                        </ProfileLink>
                      );

                      const bubble = (
                        <div
                          className={`max-w-[75%] rounded-2xl px-4 py-2.5 sm:max-w-[65%] ${
                            isMine
                              ? "rounded-br-sm bg-[#FF7900] text-white"
                              : "rounded-bl-sm border border-slate-200 bg-white text-[#0B1F3A]"
                          }`}
                        >
                          <p className="whitespace-pre-wrap break-words text-sm leading-6">{message.body}</p>
                          <div
                            className={`mt-1 flex items-center gap-1 text-[10px] ${
                              isMine ? "justify-end text-white/80" : "text-slate-500"
                            }`}
                          >
                            <span>
                              {new Date(message.created_at).toLocaleTimeString("en-NG", {
                                hour: "numeric",
                                minute: "2-digit",
                              })}
                            </span>
                            {/* One tick = sent. Two navy ticks = the other person has opened it. */}
                            {isMine &&
                              (message.read_at ? (
                                <CheckCheck size={14} strokeWidth={2.5} role="img" aria-label="Read" className="text-[#0B1F3A]" />
                              ) : (
                                <Check size={14} strokeWidth={2.5} role="img" aria-label="Sent" />
                              ))}
                          </div>
                        </div>
                      );

                      return (
                        <div key={message.id}>
                          {showDay && (
                            <p className="my-3 text-center text-xs font-semibold text-slate-400">
                              {dayLabel(message.created_at)}
                            </p>
                          )}
                          <div className={`flex items-end gap-2 ${isMine ? "justify-end" : "justify-start"}`}>
                            {isMine ? (
                              <>
                                {bubble}
                                {avatar}
                              </>
                            ) : (
                              <>
                                {avatar}
                                {bubble}
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={bottomRef} />
                </div>

                {threadError && (
                  <p role="alert" className="mx-3 mb-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    {threadError}
                  </p>
                )}

                {/* Composer */}
                <form
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendMessage();
                  }}
                  className="flex items-end gap-2 border-t border-slate-100 bg-white p-3"
                >
                  <label htmlFor="chat-message" className="sr-only">Write a message</label>
                  <textarea
                    id="chat-message"
                    ref={composerRef}
                    value={messageText}
                    onChange={(e) => setMessageText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        void sendMessage();
                      }
                    }}
                    placeholder="Write a message..."
                    rows={1}
                    maxLength={5000}
                    disabled={sending}
                    style={{ maxHeight: COMPOSER_MAX_HEIGHT }}
                    className="min-h-11 flex-1 resize-none overflow-y-auto rounded-xl border border-slate-200 px-4 py-2.5 text-base leading-6 outline-none transition focus:border-orange-400 focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100 sm:text-sm"
                  />
                  <button
                    type="submit"
                    disabled={!messageText.trim() || sending}
                    aria-label="Send message"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ backgroundColor: orange }}
                  >
                    <Send size={18} />
                  </button>
                </form>
              </>
            )}
          </div>
        </section>
      </div>

      {/* New chat */}
      {newChatOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-950/45 p-0 sm:items-center sm:p-4"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeNewChat();
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="new-chat-title"
            className="flex max-h-[85dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
          >
            <header className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div>
                <h2 id="new-chat-title" className="font-extrabold" style={{ color: navy }}>New chat</h2>
                <p className="mt-1 text-xs text-slate-500">Search for a student by name, @username or university.</p>
              </div>
              <button
                type="button"
                aria-label="Close new chat"
                onClick={closeNewChat}
                className="rounded-full p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </header>

            <div className="p-4">
              <label className="flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2.5">
                <Search size={17} className="shrink-0 text-slate-500" aria-hidden="true" />
                <input
                  autoFocus
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  placeholder="Search by name or @username..."
                  aria-label="Search students"
                  className="w-full bg-transparent text-base outline-none placeholder:text-slate-500 sm:text-sm"
                />
              </label>
            </div>

            <div className="min-h-40 flex-1 overflow-y-auto px-2 pb-4">
              {newChatError && (
                <p role="alert" className="mx-2 mb-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">{newChatError}</p>
              )}

              {userQuery.trim().length < 2 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500">Type at least 2 letters to search.</p>
              ) : userSearching ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500">Searching...</p>
              ) : userResults.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-slate-500">No students found.</p>
              ) : (
                userResults.map((user) => (
                  <button
                    key={String(user.id)}
                    type="button"
                    disabled={startingId !== null}
                    onClick={() => void startDirectChat(user)}
                    className="flex w-full items-center gap-3 rounded-xl p-3 text-left transition hover:bg-slate-50 disabled:opacity-60"
                  >
                    <PersonAvatar name={user.name ?? ""} src={storageUrl(user.avatar_path)} className="h-11 w-11" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">{user.name}</p>
                      {(user.username || user.university) && (
                        <p className="truncate text-xs text-slate-500">
                          {user.username ? `@${user.username}` : ""}
                          {user.username && user.university ? " · " : ""}
                          {user.university ?? ""}
                        </p>
                      )}
                    </div>
                    <span className="shrink-0 text-xs font-bold text-[#B45309]">
                      {startingId === user.id ? "Opening..." : "Message"}
                    </span>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      )}

      {/* On mobile the open thread takes the whole screen, so the bottom nav only shows on the list. */}
      {activeId === null && <BottomNav />}
    </main>
  );
}