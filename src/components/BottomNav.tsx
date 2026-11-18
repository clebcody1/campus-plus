"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import {
  Home,
  CalendarDays,
  ShoppingBag,
  UserRound,
  MessageCircle,
  type LucideIcon,
} from "lucide-react";

import { API_URL } from "@/lib/api";

type NavItem = { icon: LucideIcon; label: string; href: string };

const LEFT_ITEMS: NavItem[] = [
  { icon: Home, label: "Home", href: "/" },
  { icon: CalendarDays, label: "Events", href: "/events" },
];

const RIGHT_ITEMS: NavItem[] = [
  { icon: ShoppingBag, label: "Market", href: "/market" },
  { icon: UserRound, label: "Profile", href: "/profile" },
];

const CHAT_HREF = "/chat";

export default function BottomNav() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);

  /* Unread message count for the Chat badge.
     Refreshes every 30 seconds, when the tab regains focus, and whenever the
     student moves between pages (so it clears after reading a conversation). */
  useEffect(() => {
    let cancelled = false;

    async function loadUnread() {
      const token = window.localStorage.getItem("campus_life_token");

      if (!token) {
        if (!cancelled) setUnread(0);
        return;
      }

      // Don't poll a tab nobody is looking at.
      if (document.visibilityState === "hidden") return;

      try {
        const response = await fetch(`${API_URL}/conversations`, {
          headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
          cache: "no-store",
        });

        if (!response.ok) return;

        const result = await response.json();
        const rows: { unread_count?: number }[] = Array.isArray(result)
          ? result
          : result.data ?? [];

        const total = rows.reduce(
          (sum, item) => sum + Number(item.unread_count ?? 0),
          0
        );

        if (!cancelled) setUnread(total);
      } catch {
        // A failed count should never break the navigation bar.
      }
    }

    loadUnread();

    const interval = window.setInterval(loadUnread, 30000);
    window.addEventListener("focus", loadUnread);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", loadUnread);
    };
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(`${href}/`);

  const chatActive = isActive(CHAT_HREF);

  const renderItem = ({ icon: Icon, label, href }: NavItem) => {
    const active = isActive(href);

    return (
      <Link
        key={href}
        href={href}
        aria-current={active ? "page" : undefined}
        className={`flex h-full flex-col items-center justify-center gap-1 text-xs font-semibold transition-colors ${
          active ? "text-[#0B1F3A]" : "text-slate-500 hover:text-[#0B1F3A]"
        }`}
      >
        <span
          className={`flex h-8 w-14 items-center justify-center rounded-full transition ${
            active ? "bg-[#FF7900]" : ""
          }`}
        >
          <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span>{label}</span>
      </Link>
    );
  };

  return (
    <nav
      aria-label="Main navigation"
      className="fixed inset-x-0 bottom-0 z-40 lg:hidden"
    >
      <div className="relative">
        {/* ── Curved background: left bar | notch | right bar ── */}
        <div className="flex h-16 drop-shadow-[0_-2px_6px_rgba(15,23,42,0.06)]">
          <div className="flex-1 border-t border-slate-200 bg-white" />

          <svg
            width="104"
            height="64"
            viewBox="0 0 104 64"
            className="shrink-0"
            aria-hidden="true"
          >
            <path
              d="M0 0.5 H10 C26 0.5 28 38 52 38 C76 38 78 0.5 94 0.5 H104 V64 H0 Z"
              fill="white"
            />
            <path
              d="M0 0.5 H10 C26 0.5 28 38 52 38 C76 38 78 0.5 94 0.5 H104"
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          </svg>

          <div className="flex-1 border-t border-slate-200 bg-white" />
        </div>

        {/* white filler under the home indicator */}
        <div className="h-[env(safe-area-inset-bottom)] bg-white" />

        {/* ── Items: 5 equal columns, Chat is the middle one ── */}
        <div className="absolute inset-x-0 top-0 mx-auto grid h-16 max-w-lg grid-cols-5 px-1">
          {LEFT_ITEMS.map(renderItem)}

          <Link
            href={CHAT_HREF}
            aria-label={unread > 0 ? `Chat, ${unread} unread` : "Chat"}
            aria-current={chatActive ? "page" : undefined}
            className="flex h-full flex-col items-center"
          >
            <span
              className={`relative -mt-1.5 flex h-10 w-10 items-center justify-center rounded-full text-white shadow-md shadow-[#FF7900]/40 transition active:scale-95 ${
                chatActive ? "bg-[#0B1F3A]" : "bg-[#FF7900]"
              }`}
            >
              <MessageCircle size={20} strokeWidth={1.8} aria-hidden="true" />

              {unread > 0 && (
                <span
                  aria-hidden="true"
                  className={`absolute -right-1.5 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white px-1 text-[10px] font-bold leading-none ${
                    chatActive ? "bg-[#FF7900] text-[#0B1F3A]" : "bg-[#0B1F3A] text-white"
                  }`}
                >
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </span>
            <span
              className={`mt-1.5 text-xs font-semibold ${
                chatActive ? "text-[#0B1F3A]" : "text-slate-500"
              }`}
            >
              Chat
            </span>
          </Link>

          {RIGHT_ITEMS.map(renderItem)}
        </div>
      </div>
    </nav>
  );
}