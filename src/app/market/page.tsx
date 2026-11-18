"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CalendarDays,
  Home as HomeIcon,
  ShoppingBag,
  UserRound,
  MessageCircle,
  Check,
  CheckCheck,
  GraduationCap,
  X,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import VerifiedBadge from "@/components/VerifiedBadge";
import { API_URL, API_ORIGIN, storageUrl } from "@/lib/api";

const navy = "#0B1F3A";
const orange = "#FF7900";

// 16px on phones stops iOS Safari zooming in (and misaligning the page)
// when a field is focused. It drops back to 14px from the sm breakpoint up.
const fieldText = "text-base sm:text-sm";

const CATEGORIES = [
  "All categories",
  "Books",
  "Electronics",
  "Fashion",
  "Hostel essentials",
  "Food",
  "Beauty",
  "Other",
];

const marketNavigationItems = [
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

// A student's profile picture, or their first initial if they have none.
function ProfilePicture({
  name,
  src,
  className = "h-8 w-8 text-xs",
}: {
  name: string;
  src?: string | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);

  return (
    <div
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-50 font-bold text-[#C45B00] ${className}`}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        (name.trim().charAt(0) || "S").toUpperCase()
      )}
    </div>
  );
}

type Seller = {
  id?: number | string;
  name?: string;
  username?: string | null;
  avatar_path?: string | null;
  email?: string;
  university?: string;
  is_verified?: boolean;
  role?: string;
};

type Listing = {
  id: number | string;
  user_id?: number | string;
  title: string;
  description?: string | null;
  price: number | string;
  category?: string | null;
  condition?: string | null;
  campus?: string | null;
  university?: string | null;
  images?: string[] | null;
  image_url?: string | null;
  image_path?: string | null;
  status?: string | null;
  seller?: Seller | null;
  seller_name?: string | null;
  seller_email?: string | null;
};

type Conversation = {
  id: number;
  listing_id: number;
  buyer_id: number;
  seller_id: number;
};

type InboxConversation = Conversation & {
  listing?: Listing;
  buyer?: Seller;
  seller?: Seller;
  messages?: ChatMessage[];
  unread_count?: number;
};

type ChatMessage = {
  id: number;
  conversation_id: number;
  sender_id: number;
  body: string;
  read_at: string | null;
  created_at: string;
  sender: {
    id: number;
    name: string;
  };
};

type Paginated<T> = {
  data?: T[];
  current_page?: number;
  last_page?: number;
};

function formatNaira(value: number | string) {
  const amount = typeof value === "number" ? value : Number(value);

  return Number.isFinite(amount)
    ? new Intl.NumberFormat("en-NG", {
        style: "currency",
        currency: "NGN",
        maximumFractionDigits: 0,
      }).format(amount)
    : `₦${value}`;
}

function getImageUrl(item: Listing) {
  const value = item.image_url || item.image_path || item.images?.[0];

  if (typeof value !== "string" || !value.trim()) return "";

  const path = value.trim();

  // Absolute URLs should be used as they are.
  if (/^https?:\/\//i.test(path)) return path;

  // Remove leading slashes and normalize Laravel storage paths.
  const cleanPath = path.replace(/^\/+/, "");
  const relativePath = cleanPath.startsWith("storage/")
    ? cleanPath.slice("storage/".length)
    : cleanPath;

  // Laravel public files are served from /storage/<path>.
  return `${API_ORIGIN}/storage/${relativePath}`;
}

function getToken() {
  return typeof window !== "undefined"
    ? window.localStorage.getItem("campus_life_token")
    : null;
}

async function apiRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
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
    if (response.status === 401) {
      throw new Error("Please log in to use Marketplace messaging.");
    }

    if (response.status === 419) {
      throw new Error("Your session expired. Please log in again.");
    }

    throw new Error(
      result.message || `Request failed (HTTP ${response.status}).`
    );
  }

  return result as T;
}

export default function MarketPage() {
  const pathname = usePathname();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("All categories");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"browse" | "mine">("browse");
  const [myListings, setMyListings] = useState<Listing[]>([]);
  const [listingModalOpen, setListingModalOpen] = useState(false);
  const [editingListing, setEditingListing] = useState<Listing | null>(null);
  const [listingSaving, setListingSaving] = useState(false);
  const [listingError, setListingError] = useState("");
  const [listingNotice, setListingNotice] = useState("");
  const [productTitle, setProductTitle] = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productCategory, setProductCategory] = useState("Other");
  const [productCondition, setProductCondition] = useState("good");
  const [productCampus, setProductCampus] = useState("LAUTECH");
  const [productPhotos, setProductPhotos] = useState<File[]>([]);
  const [deletingId, setDeletingId] = useState<number | string | null>(null);

  const [selected, setSelected] = useState<Listing | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [chatPartner, setChatPartner] = useState("");
  const [chatPartnerPerson, setChatPartnerPerson] = useState<Seller | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [messageText, setMessageText] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const [chatNotice, setChatNotice] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);

  const [inboxOpen, setInboxOpen] = useState(false);
  const [conversations, setConversations] = useState<InboxConversation[]>([]);
  const [inboxLoading, setInboxLoading] = useState(false);
  const [unreadTotal, setUnreadTotal] = useState(0);

  // Stop the page behind a dialog from scrolling, and keep its width steady
  // so nothing shifts sideways when the scrollbar disappears.
  const anyModalOpen = listingModalOpen || inboxOpen || Boolean(selected || conversation);

  useEffect(() => {
    if (!anyModalOpen) return;

    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
    };
  }, [anyModalOpen]);

  useEffect(() => {
    let cancelled = false;

    async function loadListings() {
      try {
        setLoading(true);
        setError("");

        // This is the actual GET route registered in Laravel.
        const result = await apiRequest<Paginated<Listing> | Listing[]>(
          "/marketplace"
        );

        const rows = Array.isArray(result) ? result : result.data ?? [];

        if (!cancelled) setListings(rows);
      } catch (e) {
        if (!cancelled) {
          setError(
            e instanceof Error ? e.message : "Could not load listings."
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadListings();

    return () => {
      cancelled = true;
    };
  }, []);

  // Work out who "me" is so sent messages can be told apart from received ones.
  useEffect(() => {
    if (!getToken()) return;

    let id: number | null = null;

    const storedId = window.localStorage.getItem("campus_life_user_id");
    if (storedId && Number.isFinite(Number(storedId))) id = Number(storedId);

    // Fall back to the user object saved by the login / profile pages.
    if (id === null) {
      try {
        const raw = window.localStorage.getItem("campus_life_user");
        const parsed = raw ? JSON.parse(raw) : null;
        if (parsed && Number.isFinite(Number(parsed.id))) id = Number(parsed.id);
      } catch {
        // Ignore a corrupt cached user.
      }
    }

    if (id !== null) setCurrentUserId(id);

    // The server's answer wins, so signing in as a different student on the same
    // device can never mix up whose messages are whose.
    apiRequest<{ user?: { id?: number }; id?: number }>("/user")
      .then((result) => {
        const fetched = Number(result.user?.id ?? result.id);
        if (Number.isFinite(fetched)) setCurrentUserId(fetched);
      })
      .catch(() => {});
  }, []);

  const loadMyListings = useCallback(async () => {
    if (!getToken()) {
      setMyListings([]);
      return;
    }
    const result = await apiRequest<Paginated<Listing> | Listing[]>("/marketplace/mine");
    setMyListings(Array.isArray(result) ? result : result.data ?? []);
  }, []);

  function openCreateListing() {
    if (!getToken()) {
      setListingError("Please log in before creating a product listing.");
      setListingModalOpen(true);
      return;
    }
    setEditingListing(null);
    setProductTitle("");
    setProductDescription("");
    setProductPrice("");
    setProductCategory("Other");
    setProductCondition("good");
    setProductCampus("LAUTECH");
    setProductPhotos([]);
    setListingError("");
    setListingNotice("");
    setListingModalOpen(true);
  }

  function openEditListing(item: Listing) {
    setEditingListing(item);
    setProductTitle(item.title ?? "");
    setProductDescription(item.description ?? "");
    setProductPrice(String(item.price ?? ""));
    setProductCategory(item.category || "Other");
    setProductCondition(item.condition || "good");
    setProductCampus(item.campus || item.university || "LAUTECH");
    setProductPhotos([]);
    setListingError("");
    setListingNotice("");
    setListingModalOpen(true);
  }

  async function refreshListings() {
    const result = await apiRequest<Paginated<Listing> | Listing[]>("/marketplace");
    setListings(Array.isArray(result) ? result : result.data ?? []);
    if (getToken()) await loadMyListings();
  }

  async function saveListing(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!getToken()) {
      setListingError("Please log in before creating or editing a listing.");
      return;
    }
    if (!productTitle.trim() || !productPrice || Number(productPrice) < 0) {
      setListingError("Enter a product name and a valid price.");
      return;
    }
    if (productPhotos.length > 5) {
      setListingError("You can upload up to five photos.");
      return;
    }

    const formData = new FormData();
    formData.append("title", productTitle.trim());
    formData.append("description", productDescription.trim());
    formData.append("price", productPrice);
    formData.append("category", productCategory);
    formData.append("condition", productCondition);
    formData.append("campus", productCampus.trim() || "LAUTECH");
    productPhotos.forEach((photo) => formData.append("images[]", photo));
    // Laravel's method spoofing keeps multipart photo uploads compatible with PUT routes.
    if (editingListing) formData.append("_method", "PUT");

    try {
      setListingSaving(true);
      setListingError("");
      setListingNotice("");
      const token = getToken();
      const path = editingListing ? `/marketplace/${editingListing.id}` : "/marketplace";
      const response = await fetch(`${API_URL}${path}`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: formData,
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        const validationMessage = result.errors
          ? Object.values(result.errors).flat().join(" ")
          : "";
        throw new Error(validationMessage || result.message || `Could not save listing (HTTP ${response.status}).`);
      }
      await refreshListings();
      setListingNotice(editingListing ? "Product updated successfully." : "Product listed successfully.");
      setListingModalOpen(false);
      setView("mine");
    } catch (e) {
      setListingError(e instanceof Error ? e.message : "Could not save this product.");
    } finally {
      setListingSaving(false);
    }
  }

  async function deleteListing(item: Listing) {
    const confirmed = window.confirm(`Delete “${item.title}”? This cannot be undone.`);
    if (!confirmed) return;
    try {
      setDeletingId(item.id);
      setListingNotice("");
      await apiRequest(`/marketplace/${item.id}`, { method: "DELETE" });
      await refreshListings();
      setListingNotice("Product deleted successfully.");
    } catch (e) {
      setListingNotice(e instanceof Error ? e.message : "Could not delete this product.");
    } finally {
      setDeletingId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase();

    return listings.filter((item) => {
      const matchesText =
        !q ||
        [
          item.title,
          item.description,
          item.category,
          item.seller?.name,
          item.seller_name,
        ].some((value) =>
          String(value ?? "")
            .toLocaleLowerCase()
            .includes(q)
        );

      const matchesCategory =
        category === "All categories" ||
        String(item.category ?? "").toLocaleLowerCase() ===
          category.toLocaleLowerCase();

      const status = String(item.status ?? "active").toLocaleLowerCase();
      const available = ["available", "active", "published"].includes(status);

      const university = String(
        item.campus ?? item.university ?? item.seller?.university ?? "LAUTECH"
      )
        .toLocaleLowerCase()
        .replace(/[^a-z]/g, "");

      return matchesText && matchesCategory && available &&
        (university.includes("lautech") || !university);
    });
  }, [listings, search, category]);

  const loadMessages = useCallback(async (conversationId: number) => {
    const result = await apiRequest<Paginated<ChatMessage>>(
      `/conversations/${conversationId}/messages`
    );

    // Laravel returns messages oldest-first in this controller, paginated.
    const rows = result.data ?? [];
    setMessages(rows);

    try {
      await apiRequest(`/conversations/${conversationId}/read`, {
        method: "PATCH",
      });
    } catch {
      // Loading messages should still succeed if the read receipt fails.
    }
  }, []);

  const loadInbox = useCallback(async () => {
    if (!getToken()) {
      setChatError("Please log in to view your messages.");
      return;
    }

    try {
      setInboxLoading(true);

      const result = await apiRequest<Paginated<InboxConversation>>("/conversations");

      const rows = result.data ?? [];
      setConversations(rows);
      setUnreadTotal(
        rows.reduce((sum, item) => sum + (item.unread_count ?? 0), 0)
      );
    } catch (e) {
      setChatError(
        e instanceof Error ? e.message : "Could not load your inbox."
      );
    } finally {
      setInboxLoading(false);
    }
  }, []);

  // The person you are talking to (not the product).
  function partnerPerson(item: InboxConversation) {
    return currentUserId === null
      ? null
      : currentUserId === item.seller_id
        ? item.buyer
        : item.seller;
  }

  // The name of the person you are talking to (not the product).
  function partnerName(item: InboxConversation) {
    const other =
      currentUserId === null
        ? null
        : currentUserId === item.seller_id
          ? item.buyer
          : item.seller;

    return other?.name || item.listing?.title || "Marketplace chat";
  }

  async function openExistingConversation(item: InboxConversation) {
    try {
      setChatError("");
      setChatNotice("");
      setConversation(item);
      setChatPartner(partnerName(item));
      setChatPartnerPerson(partnerPerson(item) ?? null);
      setSelected(item.listing ?? null);
      setMessages([]);
      setInboxOpen(false);
      setChatLoading(true);

      await loadMessages(item.id);
    } catch (e) {
      setChatError(
        e instanceof Error ? e.message : "Could not load conversation."
      );
    } finally {
      setChatLoading(false);
    }
  }

  async function sendMessage(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!conversation || !messageText.trim() || sending) return;

    try {
      setSending(true);
      setChatError("");
      setChatNotice("");

      await apiRequest(`/conversations/${conversation.id}/messages`, {
        method: "POST",
        body: JSON.stringify({ body: messageText.trim() }),
      });

      setMessageText("");
      await loadMessages(conversation.id);

      setChatNotice("Message sent.");
    } catch (e) {
      setChatError(
        e instanceof Error ? e.message : "Could not send your message."
      );
    } finally {
      setSending(false);
    }
  }

  // Automatic refresh while a conversation is open.
  useEffect(() => {
    if (!conversation) return;

    let cancelled = false;

    const refresh = async () => {
      if (cancelled) return;

      try {
        await loadMessages(conversation.id);
      } catch (e) {
        if (!cancelled) {
          setChatError(
            e instanceof Error ? e.message : "Could not refresh messages."
          );
        }
      }
    };

    const interval = window.setInterval(refresh, 4000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [conversation?.id, loadMessages]);

  useEffect(() => {
    if (!inboxOpen) return;

    loadInbox();

    const interval = window.setInterval(loadInbox, 10000);
    return () => window.clearInterval(interval);
  }, [inboxOpen, loadInbox]);

  // Arriving from a product page ("Message seller"): /market?chat=<listing id>
  // opens that conversation in the chat popup. Starting a conversation is safe to
  // repeat because Laravel returns the existing one.
  useEffect(() => {
    if (currentUserId === null || !getToken()) return;

    const listingId = new URLSearchParams(window.location.search).get("chat");
    if (!listingId) return;

    // Remove the parameter so a refresh doesn't reopen the chat.
    window.history.replaceState(null, "", "/market");

    (async () => {
      try {
        const result = await apiRequest<{ conversation: InboxConversation }>(
          `/marketplace/${encodeURIComponent(listingId)}/conversation`,
          { method: "POST", body: JSON.stringify({}) }
        );
        await openExistingConversation(result.conversation);
      } catch (e) {
        setListingNotice(
          e instanceof Error ? e.message : "Could not open the conversation."
        );
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  function closeChat() {
    setSelected(null);
    setConversation(null);
    setChatPartner("");
    setChatPartnerPerson(null);
    setMessages([]);
    setMessageText("");
    setChatError("");
    setChatNotice("");
  }

  const otherParticipantName =
    chatPartner ||
    (conversation
      ? currentUserId === conversation.seller_id
        ? selected?.seller?.name || selected?.seller_name || "Buyer"
        : selected?.seller?.name || selected?.seller_name || "Seller"
      : "Seller");

  return (
    <main className="min-h-screen overflow-x-clip bg-[#F7F8FA] pb-24 text-[#0B1F3A]">
      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[210px_minmax(0,1fr)] lg:px-8">
        {/* Left sidebar (desktop) */}
        <aside className="hidden lg:block">
          <div className="sticky top-8 rounded-2xl border border-slate-200 bg-white p-4">
            <p className="mb-4 text-xs font-bold uppercase tracking-widest text-slate-400">Your campus</p>
            <div className="mb-5 rounded-xl p-3" style={{ backgroundColor: "#F0F4F9" }}>
              <p className="flex items-center gap-2 font-bold" style={{ color: navy }}>
                <GraduationCap size={18} /> Select university
              </p>
              <p className="mt-1 text-xs text-slate-500">Choose your campus</p>
            </div>

            <nav className="space-y-2" aria-label="Campus sections">
              {marketNavigationItems.map(({ label, href }) => {
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

            <div className="mt-6 rounded-xl p-4" style={{ backgroundColor: "#FFF3E8" }}>
              <p className="font-bold" style={{ color: navy }}>Your campus, your people.</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">Discover what&apos;s happening across Nigerian universities.</p>
            </div>
          </div>
        </aside>

        <div className="min-w-0">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.18em] text-[#FF7900]">
              Campus Plus · LAUTECH
            </p>
            <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
              Marketplace
            </h1>
            <p className="mt-2 text-sm text-slate-600 sm:text-base">
              Find what you need from students around your campus.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="w-fit rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
              ● LAUTECH community
            </span>
            <button
              onClick={openCreateListing}
              className="rounded-xl bg-[#FF7900] px-4 py-3 text-sm font-bold text-[#0B1F3A] hover:bg-[#FF8F26]"
            >
              + Sell an item
            </button>
            <button
              onClick={() => {
                setChatError("");
                setInboxOpen(true);
              }}
              className="relative rounded-xl bg-[#0B1F3A] px-4 py-3 text-sm font-bold text-white hover:bg-[#16365F]"
            >
              Messages
              {unreadTotal > 0 && (
                <span className="ml-2 rounded-full bg-[#FF7900] px-2 py-0.5 text-xs text-[#0B1F3A]">
                  {unreadTotal}
                </span>
              )}
            </button>
          </div>
        </header>

        <section className="relative mb-8 overflow-hidden rounded-3xl bg-[#0B1F3A] p-6 text-white shadow-lg sm:p-9">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full border-[28px] border-white/5"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-24 right-28 h-48 w-48 rounded-full bg-[#FF7900]/15 blur-2xl"
          />
          <div className="relative max-w-2xl">
            <span className="inline-flex rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold tracking-wide text-orange-200">
              MADE FOR LAUTECH STUDENTS
            </span>
            <h2 className="mt-4 text-3xl font-extrabold leading-tight sm:text-4xl">
              Good finds. Right on campus.
            </h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-slate-200 sm:text-base">
              Discover student essentials, find a better deal, and connect
              directly with sellers in your campus community.
            </p>
            <div className="mt-5 flex flex-wrap gap-2 text-xs font-medium text-slate-200 sm:text-sm">
              <span className="rounded-full bg-white/10 px-3 py-2">
                Books &amp; study supplies
              </span>
              <span className="rounded-full bg-white/10 px-3 py-2">
                Gadgets &amp; electronics
              </span>
              <span className="rounded-full bg-white/10 px-3 py-2">
                Hostel essentials
              </span>
            </div>
          </div>
        </section>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          <button
            onClick={() => setView("browse")}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold ${view === "browse" ? "bg-[#0B1F3A] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            Browse products
          </button>
          <button
            onClick={async () => {
              setView("mine");
              setListingNotice("");
              try {
                await loadMyListings();
              } catch (e) {
                setListingNotice(e instanceof Error ? e.message : "Could not load your products.");
              }
            }}
            className={`rounded-xl px-4 py-2.5 text-sm font-bold ${view === "mine" ? "bg-[#0B1F3A] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            My Products
          </button>
        </div>
        {listingNotice && !listingModalOpen && (
          <p role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{listingNotice}</p>
        )}

        {view === "browse" && (
          <>
            <section
              aria-label="Search marketplace"
              className="mb-7 grid gap-3 md:grid-cols-[minmax(0,1fr)_240px]"
            >
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search books, gadgets, clothes..."
                aria-label="Search listings"
                className={`h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 outline-none focus:border-[#FF7900] focus:ring-2 focus:ring-orange-100 ${fieldText}`}
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                aria-label="Filter by category"
                className={`h-12 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-4 outline-none focus:border-[#FF7900] focus:ring-2 focus:ring-orange-100 ${fieldText}`}
              >
                {CATEGORIES.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </section>

            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-xl font-bold tracking-tight">
                    Find your next good deal
                  </h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {loading
                      ? "Loading listings..."
                      : `${filtered.length} ${
                          filtered.length === 1 ? "item" : "items"
                        } found`}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setSearch("");
                    setCategory("All categories");
                  }}
                  className="rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-100"
                >
                  Clear filters
                </button>
              </div>

              {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <div
                      key={i}
                      className="overflow-hidden rounded-2xl border bg-white"
                    >
                      <div className="aspect-[4/3] animate-pulse bg-slate-100" />
                      <div className="space-y-3 p-4">
                        <div className="h-4 w-3/4 animate-pulse rounded bg-slate-100" />
                        <div className="h-4 w-1/3 animate-pulse rounded bg-slate-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : error ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                  <h3 className="font-bold text-amber-950">
                    Marketplace data could not be loaded
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-amber-900">{error}</p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#FF7900]">
                    <ShoppingBag size={26} />
                  </div>
                  <h3 className="mt-4 text-lg font-bold">No listings found</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Try another search or clear your filters.
                  </p>
                  <button
                    onClick={() => {
                      setSearch("");
                      setCategory("All categories");
                    }}
                    className="mt-4 rounded-xl bg-[#FF7900] px-4 py-2.5 text-sm font-bold text-[#0B1F3A] hover:bg-[#FF8F26]"
                  >
                    Clear filters
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
                  {filtered.map((item) => {
                    const src = getImageUrl(item);

                    return (
                      <Link
                        key={item.id}
                        href={`/market/${item.id}`}
                        aria-label={`View details for ${item.title}`}
                        className="group block overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm transition duration-200 hover:-translate-y-1 hover:border-orange-200 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]"
                      >
                        <div className="relative flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-100">
                          {src ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={src}
                              alt={item.title}
                              loading="lazy"
                              className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                            />
                          ) : (
                            <span className="text-sm text-slate-400">
                              No photo yet
                            </span>
                          )}
                          {item.category && (
                            <span className="absolute left-3 top-3 rounded-full bg-white/95 px-3 py-1 text-xs font-semibold shadow-sm">
                              {item.category}
                            </span>
                          )}
                          {(item.images?.length ?? 0) > 1 && (
                            <span className="absolute bottom-3 right-3 rounded-full bg-[#0B1F3A]/85 px-2.5 py-1 text-xs font-semibold text-white">
                              {item.images?.length} photos
                            </span>
                          )}
                        </div>

                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3">
                            <h3 className="line-clamp-2 min-h-12 font-bold">
                              {item.title}
                            </h3>
                            {item.condition && (
                              <span className="shrink-0 rounded-md bg-slate-100 px-2 py-1 text-[10px] font-semibold uppercase text-slate-600">
                                {item.condition.replace("_", " ")}
                              </span>
                            )}
                          </div>

                          <p className="mt-2 text-xl font-extrabold text-[#C45B00]">
                            {formatNaira(item.price)}
                          </p>
                          <p className="mt-2 line-clamp-2 min-h-10 text-sm leading-5 text-slate-500">
                            {item.description ||
                              "Contact the seller for more details."}
                          </p>

                          {/* The whole card is a link, so the seller row acts as its own link. */}
                          <div
                            role={item.seller?.id ? "link" : undefined}
                            tabIndex={item.seller?.id ? 0 : undefined}
                            aria-label={item.seller?.id ? `View ${item.seller?.name ?? "seller"}'s profile` : undefined}
                            onClick={(event) => {
                              if (!item.seller?.id) return;
                              event.preventDefault();
                              event.stopPropagation();
                              router.push(`/users/${item.seller.id}`);
                            }}
                            onKeyDown={(event) => {
                              if (!item.seller?.id || event.key !== "Enter") return;
                              event.preventDefault();
                              event.stopPropagation();
                              router.push(`/users/${item.seller.id}`);
                            }}
                            className={`mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 ${item.seller?.id ? "cursor-pointer hover:opacity-80" : ""}`}
                          >
                            <ProfilePicture
                              name={item.seller?.name || item.seller_name || "S"}
                              src={storageUrl(item.seller?.avatar_path)}
                            />
                            <div className="min-w-0 flex-1">
                              <p className="flex items-center gap-1 text-xs font-semibold text-slate-700">
                                <span className="truncate">
                                  {item.seller?.name || item.seller_name || "LAUTECH student"}
                                </span>
                                {item.seller?.is_verified && <VerifiedBadge className="h-3.5 w-3.5" admin={item.seller?.role === "admin"} />}
                              </p>
                              <p className="truncate text-xs text-slate-500">
                                {item.campus ||
                                  item.university ||
                                  item.seller?.university ||
                                  "LAUTECH"}
                              </p>
                            </div>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}

        {view === "mine" && (
          <section>
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold tracking-tight">My Products</h2>
                <p className="mt-1 text-sm text-slate-500">Manage the products you have listed.</p>
              </div>
              <button onClick={openCreateListing} className="shrink-0 rounded-xl bg-[#FF7900] px-4 py-2.5 text-sm font-bold text-[#0B1F3A] hover:bg-[#FF8F26]">+ Add product</button>
            </div>
            {!getToken() ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-600">Please log in to see and manage your products.</div>
            ) : myListings.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#FF7900]">
                  <ShoppingBag size={26} />
                </div>
                <h3 className="mt-4 text-lg font-bold">You haven&apos;t listed any products yet</h3>
                <p className="mt-1 text-sm text-slate-500">Your products will appear here after you list them.</p>
                <button onClick={openCreateListing} className="mt-4 rounded-xl bg-[#FF7900] px-4 py-2.5 text-sm font-bold text-[#0B1F3A] hover:bg-[#FF8F26]">Sell an item</button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
                {myListings.map((item) => {
                  const src = getImageUrl(item);
                  return (
                    <article key={item.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-slate-100">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {src ? <img src={src} alt={item.title} loading="lazy" className="h-full w-full object-cover" /> : <span className="text-sm text-slate-400">No photo yet</span>}
                      </div>
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <h3 className="line-clamp-2 font-bold">{item.title}</h3>
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase text-slate-600">{item.status || "active"}</span>
                        </div>
                        <p className="mt-2 text-xl font-extrabold text-[#C45B00]">{formatNaira(item.price)}</p>
                        <p className="mt-2 line-clamp-2 text-sm text-slate-500">{item.description || "No description provided."}</p>
                        <div className="mt-4 grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
                          <button onClick={() => openEditListing(item)} className="rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-bold hover:bg-slate-50">Edit</button>
                          <button onClick={() => deleteListing(item)} disabled={deletingId === item.id} className="rounded-xl bg-red-50 px-3 py-2.5 text-sm font-bold text-red-700 hover:bg-red-100 disabled:opacity-50">{deletingId === item.id ? "Deleting..." : "Delete"}</button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
        </div>
      </div>

      <BottomNav />

      {listingModalOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end justify-center overscroll-none bg-[#071426]/60 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="listing-form-title"
          onMouseDown={(e) => { if (e.target === e.currentTarget) setListingModalOpen(false); }}
        >
          <form
            onSubmit={saveListing}
            className="flex max-h-[92dvh] w-full max-w-2xl min-w-0 flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b p-5">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-[#C45B00]">Campus Plus Marketplace</p>
                <h2 id="listing-form-title" className="mt-1 truncate text-xl font-extrabold">{editingListing ? "Edit product" : "Sell an item"}</h2>
              </div>
              <button type="button" aria-label="Close product form" onClick={() => setListingModalOpen(false)} className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100">
                <X size={19} />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-5">
              {listingError && <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">{listingError}</p>}

              {!getToken() ? (
                <p className="text-sm text-slate-600">Please log in to create or manage a listing.</p>
              ) : (
                <>
                  <label className="block text-sm font-semibold">
                    Product name *
                    <input
                      required
                      value={productTitle}
                      onChange={(e) => setProductTitle(e.target.value)}
                      maxLength={255}
                      placeholder="e.g. Used scientific calculator"
                      className={`mt-1 h-11 w-full min-w-0 rounded-xl border border-slate-200 px-3 font-normal outline-none focus:border-[#FF7900] ${fieldText}`}
                    />
                  </label>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block min-w-0 text-sm font-semibold">
                      Price (₦) *
                      <input
                        required
                        type="number"
                        inputMode="decimal"
                        min="0"
                        step="0.01"
                        value={productPrice}
                        onChange={(e) => setProductPrice(e.target.value)}
                        placeholder="15000"
                        className={`mt-1 h-11 w-full min-w-0 rounded-xl border border-slate-200 px-3 font-normal outline-none focus:border-[#FF7900] ${fieldText}`}
                      />
                    </label>

                    <label className="block min-w-0 text-sm font-semibold">
                      Category
                      <select
                        value={productCategory}
                        onChange={(e) => setProductCategory(e.target.value)}
                        className={`mt-1 h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-[#FF7900] ${fieldText}`}
                      >
                        {CATEGORIES.filter((c) => c !== "All categories").map((c) => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </label>

                    <label className="block min-w-0 text-sm font-semibold">
                      Condition
                      <select
                        value={productCondition}
                        onChange={(e) => setProductCondition(e.target.value)}
                        className={`mt-1 h-11 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 font-normal outline-none focus:border-[#FF7900] ${fieldText}`}
                      >
                        <option value="new">New</option>
                        <option value="like_new">Like new</option>
                        <option value="good">Good</option>
                        <option value="fair">Fair</option>
                        <option value="used">Used</option>
                      </select>
                    </label>

                    <label className="block min-w-0 text-sm font-semibold">
                      Campus
                      <input
                        value={productCampus}
                        onChange={(e) => setProductCampus(e.target.value)}
                        maxLength={255}
                        className={`mt-1 h-11 w-full min-w-0 rounded-xl border border-slate-200 px-3 font-normal outline-none focus:border-[#FF7900] ${fieldText}`}
                      />
                    </label>
                  </div>

                  <label className="block text-sm font-semibold">
                    Description
                    <textarea
                      value={productDescription}
                      onChange={(e) => setProductDescription(e.target.value)}
                      rows={4}
                      maxLength={5000}
                      placeholder="Describe the item and its condition..."
                      className={`mt-1 w-full min-w-0 resize-y rounded-xl border border-slate-200 px-3 py-3 font-normal outline-none focus:border-[#FF7900] ${fieldText}`}
                    />
                  </label>

                  <label className="block text-sm font-semibold">
                    Product photos (up to 5)
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      onChange={(e) => {
                        // Add to what is already chosen (up to 5) instead of replacing it.
                        const picked = Array.from(e.target.files ?? []);
                        e.target.value = "";
                        setProductPhotos((current) => [...current, ...picked].slice(0, 5));
                      }}
                      className="mt-2 block w-full min-w-0 rounded-xl border border-slate-200 p-3 text-sm font-normal"
                    />
                    <span className="mt-1 block text-xs font-normal text-slate-500">
                      JPG, PNG, or WebP. Choose up to five photos. {editingListing ? "If you don't choose new photos, your existing photos will remain unchanged." : ""}
                    </span>
                  </label>

                  {productPhotos.length > 0 && (
                    <div>
                      <p className="text-sm text-slate-600">
                        {productPhotos.length} of 5 photos selected. The first one is the cover photo.
                      </p>
                      <ul className="mt-2 flex flex-wrap gap-2">
                        {productPhotos.map((photo, index) => (
                          <li
                            key={`${photo.name}-${index}`}
                            className="flex min-w-0 max-w-full items-center gap-2 rounded-full bg-slate-100 py-1 pl-3 pr-1 text-xs font-medium text-slate-700"
                          >
                            <span className="truncate">{index === 0 ? "Cover · " : ""}{photo.name}</span>
                            <button
                              type="button"
                              aria-label={`Remove ${photo.name}`}
                              onClick={() => setProductPhotos((current) => current.filter((_, i) => i !== index))}
                              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full hover:bg-slate-200"
                            >
                              <X size={12} />
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
            </div>

            <div className="flex justify-end gap-2 border-t p-4">
              <button type="button" onClick={() => setListingModalOpen(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold">Cancel</button>
              <button type="submit" disabled={listingSaving || !getToken()} className="rounded-xl bg-[#FF7900] px-5 py-2.5 text-sm font-bold text-[#0B1F3A] hover:bg-[#FF8F26] disabled:opacity-50">{listingSaving ? "Saving..." : editingListing ? "Save changes" : "List product"}</button>
            </div>
          </form>
        </div>
      )}

      {/* Inbox */}
      {inboxOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center overscroll-none bg-[#071426]/60 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="inbox-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setInboxOpen(false);
          }}
        >
          <div className="flex max-h-[85dvh] w-full max-w-lg min-w-0 flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-3 border-b p-5">
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-wider text-[#C45B00]">
                  Campus Plus
                </p>
                <h2 id="inbox-title" className="text-xl font-extrabold">
                  Your messages
                </h2>
              </div>
              <button
                aria-label="Close inbox"
                onClick={() => setInboxOpen(false)}
                className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">
              {inboxLoading ? (
                <p className="p-6 text-center text-sm text-slate-500">
                  Loading conversations...
                </p>
              ) : conversations.length === 0 ? (
                <p className="p-6 text-center text-sm text-slate-500">
                  No conversations yet.
                </p>
              ) : (
                conversations.map((item) => {
                  const name = partnerName(item);
                  const lastMessage = item.messages?.[item.messages.length - 1]?.body;

                  return (
                    <button
                      key={item.id}
                      onClick={() => openExistingConversation(item)}
                      className="flex w-full items-center gap-3 rounded-xl p-3 text-left hover:bg-slate-50"
                    >
                      <ProfilePicture
                        name={name}
                        src={storageUrl(partnerPerson(item)?.avatar_path)}
                        className="h-11 w-11 text-base"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-bold">{name}</p>
                        {item.listing?.title && (
                          <p className="truncate text-xs font-semibold text-[#C45B00]">
                            Re: {item.listing.title}
                            {item.listing.price != null ? ` · ${formatNaira(item.listing.price)}` : ""}
                          </p>
                        )}
                        <p className="truncate text-sm text-slate-500">
                          {lastMessage || "Open conversation"}
                        </p>
                      </div>
                      {!!item.unread_count && (
                        <span className="shrink-0 rounded-full bg-[#FF7900] px-2 py-1 text-xs font-bold text-[#0B1F3A]">
                          {item.unread_count}
                        </span>
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}

      {/* Chat */}
      {(selected || conversation) && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center overscroll-none bg-[#071426]/60 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-title"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) closeChat();
          }}
        >
          <div className="flex max-h-[90dvh] w-full max-w-lg min-w-0 flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-start justify-between gap-4 border-b p-5">
              <div className="flex min-w-0 items-center gap-3">
                <ProfilePicture
                  name={otherParticipantName}
                  src={storageUrl(chatPartnerPerson?.avatar_path)}
                  className="h-11 w-11 text-base"
                />
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#C45B00]">
                    Marketplace chat
                  </p>
                  {chatPartnerPerson?.id ? (
                    <h2 id="contact-title" className="mt-1 truncate text-xl font-extrabold">
                      <Link
                        href={`/users/${chatPartnerPerson.id}`}
                        onClick={closeChat}
                        className="hover:underline"
                      >
                        {otherParticipantName}
                      </Link>
                    </h2>
                  ) : (
                    <h2 id="contact-title" className="mt-1 truncate text-xl font-extrabold">
                      {otherParticipantName}
                    </h2>
                  )}
                </div>
              </div>
              <button
                aria-label="Close chat"
                onClick={closeChat}
                className="shrink-0 rounded-lg p-2 text-slate-500 hover:bg-slate-100"
              >
                <X size={19} />
              </button>
            </div>

            {selected && (
              <Link
                href={`/market/${selected.id}`}
                onClick={closeChat}
                className="mx-4 mt-3 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-orange-200 hover:bg-orange-50"
              >
                <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-slate-200">
                  {getImageUrl(selected) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={getImageUrl(selected)} alt={selected.title} className="h-full w-full object-cover" />
                  ) : (
                    <ShoppingBag size={20} className="text-slate-400" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    About this item
                  </p>
                  <p className="truncate text-sm font-bold">{selected.title}</p>
                  <p className="text-sm font-extrabold text-[#C45B00]">{formatNaira(selected.price)}</p>
                </div>
                <span className="shrink-0 text-xs font-bold text-[#B45309]">View →</span>
              </Link>
            )}

            {chatError && (
              <div
                role="alert"
                className="mx-4 mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900"
              >
                {chatError}
              </div>
            )}

            {chatNotice && (
              <p className="px-4 pt-2 text-xs text-emerald-700">
                {chatNotice}
              </p>
            )}

            <div className="min-h-40 flex-1 space-y-3 overflow-y-auto overscroll-contain bg-slate-50 p-4">
              {chatLoading && messages.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500">
                  Opening conversation...
                </p>
              ) : !conversation ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-slate-600">
                    Log in to view this conversation.
                  </p>
                </div>
              ) : messages.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="font-semibold text-slate-700">
                    Start the conversation
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    Say hello and agree on a safe campus pickup.
                  </p>
                </div>
              ) : (
                messages.map((message) => {
                  const isMine =
                    currentUserId !== null &&
                    message.sender_id === currentUserId;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${
                        isMine ? "justify-end" : "justify-start"
                      }`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                          isMine
                            ? "rounded-br-sm bg-[#FF7900] text-white"
                            : "rounded-bl-sm border border-slate-200 bg-white text-[#0B1F3A]"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-sm">
                          {message.body}
                        </p>
                        <div
                          className={`mt-1 flex items-center gap-1 text-[10px] ${
                            isMine ? "justify-end text-white/80" : "text-slate-500"
                          }`}
                        >
                          <span>
                            {new Date(message.created_at).toLocaleTimeString(
                              "en-NG",
                              { hour: "numeric", minute: "2-digit" }
                            )}
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
                    </div>
                  );
                })
              )}
            </div>

            <form
              onSubmit={sendMessage}
              className="flex items-end gap-2 border-t bg-white p-3"
            >
              <textarea
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Write a message..."
                aria-label="Write a message"
                rows={2}
                maxLength={5000}
                disabled={!conversation || sending}
                className={`max-h-28 min-h-11 min-w-0 flex-1 resize-y rounded-xl border border-slate-200 px-3 py-3 outline-none focus:border-[#FF7900] focus:ring-2 focus:ring-orange-100 disabled:bg-slate-100 ${fieldText}`}
              />
              <button
                type="submit"
                disabled={!conversation || !messageText.trim() || sending}
                className="h-11 shrink-0 rounded-xl bg-[#FF7900] px-4 text-sm font-bold text-[#0B1F3A] hover:bg-[#FF8F26] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {sending ? "Sending..." : "Send"}
              </button>
            </form>

            <p className="px-4 pb-3 text-center text-xs text-slate-500">
              Agree on a safe campus pickup. Check the item before paying.
            </p>
          </div>
        </div>
      )}
    </main>
  );
}