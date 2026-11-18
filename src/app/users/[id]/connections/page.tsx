"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, UserRound, Users } from "lucide-react";
import { API_URL, storageUrl } from "@/lib/api";
import BrandMark from "@/components/BrandMark";
import BottomNav from "@/components/BottomNav";
import VerifiedBadge from "@/components/VerifiedBadge";

const navy = "#0B1F3A";
const orange = "#FF7900";

type Person = {
  id: number;
  name?: string;
  username?: string | null;
  university?: string | null;
  avatar_path?: string | null;
  is_verified?: boolean;
  role?: string;
  is_me?: boolean;
  is_following?: boolean;
  busy?: boolean;
};

type Tab = "followers" | "following";

function getToken() {
  return typeof window !== "undefined"
    ? window.localStorage.getItem("campus_life_token")
    : null;
}

function Avatar({ name, src }: { name?: string; src?: string | null }) {
  const [failed, setFailed] = useState(false);
  const initial = (name?.trim().charAt(0) || "S").toUpperCase();

  return (
    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-100 font-bold text-orange-700">
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        initial
      )}
    </span>
  );
}

export default function ConnectionsPage() {
  const params = useParams<{ id: string }>();
  const userId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [tab, setTab] = useState<Tab>("followers");
  const [ownerName, setOwnerName] = useState("");
  const [isMe, setIsMe] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Open on the tab the profile page linked to: ?tab=following
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested === "following") setTab("following");
  }, []);

  // Whose lists are these?
  useEffect(() => {
    const token = getToken();
    if (!token || !userId) return;

    let cancelled = false;

    fetch(`${API_URL}/users/${userId}`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setOwnerName(data.user?.name ?? "");
        setIsMe(Boolean(data.is_me));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const loadPeople = useCallback(async () => {
    const token = getToken();

    if (!token) {
      setError("Please log in to see this.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`${API_URL}/users/${userId}/${tab}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });

      if (!response.ok) throw new Error("Could not load this list.");

      const result = await response.json();
      const rows: Person[] = Array.isArray(result) ? result : result.data ?? [];
      setPeople(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this list.");
    } finally {
      setLoading(false);
    }
  }, [userId, tab]);

  useEffect(() => {
    if (userId) void loadPeople();
  }, [userId, tab, loadPeople]);

  async function toggleFollow(person: Person) {
    const token = getToken();
    if (!token || person.busy || person.is_me) return;

    setPeople((current) =>
      current.map((item) => (item.id === person.id ? { ...item, busy: true } : item))
    );

    try {
      const response = await fetch(`${API_URL}/users/${person.id}/follow`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Could not update.");

      setPeople((current) =>
        current.map((item) =>
          item.id === person.id
            ? { ...item, is_following: Boolean(result.is_following), busy: false }
            : item
        )
      );
    } catch (e) {
      setPeople((current) =>
        current.map((item) => (item.id === person.id ? { ...item, busy: false } : item))
      );
      setError(e instanceof Error ? e.message : "Could not update.");
    }
  }

  const tabClass = (value: Tab) =>
    `flex-1 border-b-2 px-1 pb-3 text-sm font-bold transition ${
      tab === value
        ? "border-[#FF7900] text-[#0B1F3A]"
        : "border-transparent text-slate-500 hover:text-slate-800"
    }`;

  return (
    <main className="min-h-screen bg-[#F0F4F9] pb-28 text-[#0B1F3A] lg:pb-12">
      <header className="sticky top-0 z-30 bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href={isMe ? "/profile" : `/users/${userId}`} className="flex items-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-100">
            <ArrowLeft size={18} />
            <span>Back</span>
          </Link>
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <BrandMark size={36} className="shrink-0 rounded-xl" />
            <span className="text-base font-bold tracking-tight">
              Campus <span className="text-[#FF7900]">Plus</span>
            </span>
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
        <h1 className="text-2xl font-extrabold tracking-tight">
          {isMe ? "Your connections" : ownerName ? `${ownerName}'s connections` : "Connections"}
        </h1>

        <div role="tablist" aria-label="Connections" className="mt-5 flex gap-6 border-b border-slate-300">
          <button role="tab" aria-selected={tab === "followers"} onClick={() => setTab("followers")} className={tabClass("followers")}>
            Followers
          </button>
          <button role="tab" aria-selected={tab === "following"} onClick={() => setTab("following")} className={tabClass("following")}>
            Following
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </p>
        )}

        {loading ? (
          <p className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Loading...
          </p>
        ) : people.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white px-6 py-14 text-center">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF3E8] text-[#B45309]">
              <Users size={26} />
            </span>
            <h2 className="mt-4 text-lg font-extrabold">
              {tab === "followers" ? "No followers yet" : "Not following anyone yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">
              {tab === "followers"
                ? "When students follow this account, they will appear here."
                : "Follow students to see their posts and keep up with them."}
            </p>
          </div>
        ) : (
          <ul className="mt-6 space-y-3">
            {people.map((person) => (
              <li key={person.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <Link href={`/users/${person.id}`} className="flex min-w-0 flex-1 items-center gap-3 hover:opacity-90">
                  <Avatar name={person.name} src={storageUrl(person.avatar_path)} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1 truncate text-sm font-bold">
                      {person.name ?? "Campus Plus student"}
                      {person.is_verified && (
                        <VerifiedBadge className="h-4 w-4" admin={person.role === "admin"} />
                      )}
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {person.username ? `@${person.username}` : ""}
                      {person.username && person.university ? " · " : ""}
                      {person.university ?? ""}
                    </span>
                  </span>
                </Link>

                {person.is_me ? (
                  <span className="shrink-0 text-xs font-semibold text-slate-400">You</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => void toggleFollow(person)}
                    disabled={person.busy}
                    className={`shrink-0 rounded-full px-4 py-2 text-xs font-bold transition disabled:opacity-50 ${
                      person.is_following
                        ? "border border-slate-200 text-slate-600 hover:bg-slate-50"
                        : "text-[#0B1F3A] hover:opacity-90"
                    }`}
                    style={!person.is_following ? { backgroundColor: orange } : undefined}
                  >
                    {person.busy ? "..." : person.is_following ? "Following" : "Follow"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <BottomNav />
    </main>
  );
}