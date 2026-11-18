"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Heart, Lock, MessageCircle, Star, SquarePen, Trash2 } from "lucide-react";
import BottomNav from "@/components/BottomNav";
import VerifiedBadge from "@/components/VerifiedBadge";
import PostImages from "@/components/PostImages";
import { API_URL, API_ORIGIN } from "@/lib/api";

type Rating = { count: number; average: number };

type ProfileData = {
  user: {
    id: number;
    name: string;
    username?: string | null;
    university?: string | null;
    bio?: string | null;
    course?: string | null;
    year?: string | null;
    faculty?: string | null;
    department?: string | null;
    level?: string | null;
    avatar_path?: string | null;
    is_verified?: boolean;
    role?: string | null;
  };
  followers_count: number;
  following_count: number;
  posts_count: number;
  rating?: Rating;
  is_me: boolean;
  is_following: boolean;
};

type UserPost = {
  id: number;
  content: string;
  image_path: string | null;
  image_paths?: string[] | null;
  created_at: string;
  likes_count?: number;
  comments_count?: number;
};

type Review = {
  id: number;
  seller_id: number;
  reviewer_id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  reviewer?: {
    id: number;
    name: string;
    username?: string | null;
    avatar_path?: string | null;
    is_verified?: boolean;
    university?: string | null;
  } | null;
};

type ReviewsData = {
  reviews: Review[];
  summary: Rating;
  my_review: Review | null;
  can_review: boolean;
};

function getInitials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "CP";
}

function timeAgo(dateString: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(dateString).getTime()) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hr ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;
  return new Date(dateString).toLocaleDateString();
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = window.localStorage.getItem("campus_life_token");

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
    if (response.status === 401) throw new Error("Please log in to view profiles.");
    if (response.status === 404) throw new Error("This user could not be found.");
    throw new Error(result?.message || `Request failed (HTTP ${response.status}).`);
  }

  return result as T;
}

/** Five stars, filled to the rating. Read-only. */
function Stars({ value, size = 16 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          strokeWidth={1.8}
          className={n <= Math.round(value) ? "text-[#FF7900]" : "text-slate-300"}
          fill={n <= Math.round(value) ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

/** Five stars you can tap. Used in the review form. */
function StarPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div role="radiogroup" aria-label="Your rating" className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} ${n === 1 ? "star" : "stars"}`}
          onClick={() => onChange(n)}
          className="rounded p-1 transition hover:scale-110"
        >
          <Star
            size={30}
            strokeWidth={1.6}
            className={n <= value ? "text-[#FF7900]" : "text-slate-300"}
            fill={n <= value ? "currentColor" : "none"}
          />
        </button>
      ))}
    </div>
  );
}

function UserProfileContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const userId = String(params.id ?? "");

  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [posts, setPosts] = useState<UserPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [followBusy, setFollowBusy] = useState(false);
  const [notice, setNotice] = useState("");

  // Reviews
  const [reviews, setReviews] = useState<ReviewsData | null>(null);
  const [tab, setTab] = useState<"posts" | "reviews">("posts");
  const [writing, setWriting] = useState(false);
  const [myRating, setMyRating] = useState(5);
  const [myComment, setMyComment] = useState("");
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const loadReviews = useCallback(async () => {
    try {
      const result = await apiRequest<ReviewsData>(
        `/users/${encodeURIComponent(userId)}/reviews`,
      );
      setReviews(result);
      if (result.my_review) {
        setMyRating(result.my_review.rating);
        setMyComment(result.my_review.comment ?? "");
      }
    } catch {
      // Reviews are secondary — a failure here shouldn't break the profile.
    }
  }, [userId]);

  const load = useCallback(async () => {
    if (!window.localStorage.getItem("campus_life_token")) {
      setError("Please log in to view profiles.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError("");

      const [profileResult, postsResult] = await Promise.all([
        apiRequest<ProfileData>(`/users/${encodeURIComponent(userId)}`),
        apiRequest<{ data?: UserPost[] } | UserPost[]>(`/users/${encodeURIComponent(userId)}/posts`),
      ]);

      // Your own profile lives on the Profile page.
      if (profileResult.is_me) {
        router.replace("/profile");
        return;
      }

      setProfile(profileResult);
      setPosts(Array.isArray(postsResult) ? postsResult : postsResult.data ?? []);
      void loadReviews();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load this profile.");
    } finally {
      setLoading(false);
    }
  }, [userId, router, loadReviews]);

  useEffect(() => {
    void load();
  }, [load]);

  async function toggleFollow() {
    if (!profile || followBusy) return;

    try {
      setFollowBusy(true);
      setNotice("");

      const result = await apiRequest<{ is_following: boolean; followers_count: number }>(
        `/users/${profile.user.id}/follow`,
        { method: "POST" }
      );

      setProfile({
        ...profile,
        is_following: result.is_following,
        followers_count: result.followers_count,
      });
    } catch (e) {
      setNotice(e instanceof Error ? e.message : "Could not update follow status.");
    } finally {
      setFollowBusy(false);
    }
  }

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!profile || reviewSaving) return;

    setReviewSaving(true);
    setReviewError("");

    try {
      const result = await apiRequest<{ summary: Rating }>(
        `/users/${profile.user.id}/reviews`,
        {
          method: "POST",
          body: JSON.stringify({
            rating: myRating,
            comment: myComment.trim() || null,
          }),
        },
      );

      setProfile((current) => (current ? { ...current, rating: result.summary } : current));
      setWriting(false);
      await loadReviews();
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Could not save your review.");
    } finally {
      setReviewSaving(false);
    }
  }

  async function removeMyReview() {
    const mine = reviews?.my_review;
    if (!mine) return;
    if (!window.confirm("Remove your review of this seller?")) return;

    try {
      const result = await apiRequest<{ summary: Rating }>(`/reviews/${mine.id}`, {
        method: "DELETE",
      });
      setProfile((current) => (current ? { ...current, rating: result.summary } : current));
      setMyRating(5);
      setMyComment("");
      setWriting(false);
      await loadReviews();
    } catch (e) {
      setReviewError(e instanceof Error ? e.message : "Could not remove your review.");
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F0F4F9] px-5">
        <div className="text-center" role="status">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#FF7900] border-t-transparent" />
          <p className="text-sm font-medium text-[#0B1F3A]">Loading profile...</p>
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="min-h-screen bg-[#F0F4F9] px-4 py-12 text-[#0B1F3A]">
        <div className="mx-auto max-w-md rounded-3xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-extrabold">Could not load profile</h1>
          <p className="mt-3 text-sm text-gray-600">{error || "This profile is not available."}</p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link href="/" className="rounded-xl bg-[#0B1F3A] px-5 py-3 text-sm font-bold text-white">
              Back to home
            </Link>
            <Link href="/login" className="rounded-xl border border-gray-200 px-5 py-3 text-sm font-semibold">
              Log in
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const { user } = profile;
  const isAdmin = String(user.role ?? "").toLowerCase() === "admin";
  const showVerified = Boolean(user.is_verified) || isAdmin;
  const firstName = user.name.trim().split(/\s+/)[0] || "this user";
  const username = (user.username ?? "").trim().replace(/^@+/, "");

  const departmentText = user.department || user.course || "";
  const levelText = user.level
    ? (user.level === "Postgraduate" ? "Postgraduate" : `${user.level} Level`)
    : (user.year || "");
  const tags = [user.university, departmentText, levelText].filter(Boolean) as string[];

  const rating = profile.rating ?? { count: 0, average: 0 };

  const stats = [
    { label: "Posts", value: profile.posts_count },
    { label: "Followers", value: profile.followers_count },
    { label: "Following", value: profile.following_count },
  ];

  return (
    <main className="min-h-screen bg-[#F0F4F9] pb-28 text-[#0B1F3A] lg:pb-12">
      <header className="sticky top-0 z-30 bg-white shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-slate-200 hover:bg-slate-50"
          >
            <ArrowLeft size={20} />
          </button>
          <span className="text-lg font-extrabold tracking-tight">
            Campus <span className="text-[#FF7900]">Plus</span>
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-8">
        <section className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          <div className="h-24 bg-[#0B1F3A]">
            <div className="h-full w-full bg-[radial-gradient(circle_at_85%_0%,rgba(255,121,0,0.35),transparent_55%)]" />
          </div>

          <div className="px-6 pb-6">
            <div className="-mt-12 flex h-24 w-24 items-center justify-center overflow-hidden rounded-3xl border-4 border-white bg-[#FFF3E8] text-3xl font-extrabold shadow-sm">
              {user.avatar_path ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={`${API_ORIGIN}/storage/${user.avatar_path.replace(/^\/+/, "")}`}
                  alt={`${user.name}'s profile photo`}
                  className="h-full w-full object-cover"
                />
              ) : (
                getInitials(user.name)
              )}
            </div>

            <h1 className="mt-4 flex items-center gap-2 text-2xl font-extrabold tracking-tight">
              <span className="break-words">{user.name}</span>
              {showVerified && <VerifiedBadge admin={isAdmin} />}
            </h1>
            {username && (
              <p className="mt-0.5 break-all text-sm font-medium text-gray-500">@{username}</p>
            )}

            {/* Seller rating. Shown right under the name, because when you've
                clicked through from a listing this is the thing you came to
                check. */}
            {rating.count > 0 ? (
              <button
                type="button"
                onClick={() => setTab("reviews")}
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-[#FFF3E8] px-3 py-1.5 transition hover:bg-orange-100"
              >
                <Stars value={rating.average} />
                <span className="text-sm font-bold text-[#B45309]">{rating.average.toFixed(1)}</span>
                <span className="text-xs text-slate-600">
                  ({rating.count} {rating.count === 1 ? "review" : "reviews"})
                </span>
              </button>
            ) : (
              <p className="mt-3 text-xs font-semibold text-slate-500">No seller reviews yet</p>
            )}

            {tags.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <li key={tag} className="rounded-full bg-[#F0F4F9] px-3 py-1 text-xs font-semibold text-[#0B1F3A]">
                    {tag}
                  </li>
                ))}
              </ul>
            )}

            {user.bio && (
              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-gray-700">{user.bio}</p>
            )}

            <dl className="mt-6 grid grid-cols-3 divide-x divide-gray-200 rounded-2xl border border-gray-200 py-3 text-center">
              {stats.map(({ label, value }) => (
                <div key={label} className="px-2">
                  <dd className="text-xl font-extrabold">{value}</dd>
                  <dt className="text-xs text-gray-600">{label}</dt>
                </div>
              ))}
            </dl>

            <div className="mt-5 flex items-center gap-3">
              <button
                type="button"
                onClick={() => void toggleFollow()}
                disabled={followBusy}
                aria-pressed={profile.is_following}
                className={`flex-1 rounded-xl px-5 py-3 text-sm font-bold transition disabled:opacity-60 ${
                  profile.is_following
                    ? "border border-gray-300 bg-white text-[#0B1F3A] hover:bg-gray-50"
                    : "bg-[#FF7900] text-[#0B1F3A] hover:bg-[#FF8F26]"
                }`}
              >
                {followBusy ? "Please wait..." : profile.is_following ? "Following" : "Follow"}
              </button>

              {profile.is_following ? (
                <Link
                  href={`/chat?user=${user.id}`}
                  aria-label={`Message ${user.name}`}
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0B1F3A] text-white transition hover:bg-[#15345b]"
                >
                  <MessageCircle size={20} />
                </Link>
              ) : (
                <button
                  type="button"
                  disabled
                  title={`Follow ${firstName} to send a message`}
                  aria-label={`Follow ${firstName} to send a message`}
                  className="flex h-12 w-12 shrink-0 cursor-not-allowed items-center justify-center rounded-xl bg-slate-200 text-slate-500"
                >
                  <Lock size={18} />
                </button>
              )}
            </div>

            {!profile.is_following && (
              <p className="mt-3 text-xs text-gray-500">Follow {firstName} to send a message.</p>
            )}

            {notice && (
              <p role="alert" className="mt-3 rounded-xl bg-red-50 p-3 text-sm text-red-700">
                {notice}
              </p>
            )}
          </div>
        </section>

        <section>
          <div role="tablist" aria-label="Profile sections" className="flex gap-6 border-b border-gray-300">
            {([
              ["posts", "Posts"],
              ["reviews", rating.count > 0 ? `Reviews (${rating.count})` : "Reviews"],
            ] as const).map(([id, label]) => (
              <button
                key={id}
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`-mb-px border-b-2 px-1 pb-3 text-sm font-bold transition ${
                  tab === id
                    ? "border-[#FF7900] text-[#0B1F3A]"
                    : "border-transparent text-gray-500 hover:text-gray-800"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {tab === "posts" ? (
            posts.length === 0 ? (
              <div className="mt-5 rounded-3xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF3E8] text-2xl">📝</div>
                <h3 className="mt-4 text-lg font-extrabold">No posts yet</h3>
                <p className="mt-2 text-sm text-gray-600">{user.name} hasn&apos;t shared anything yet.</p>
              </div>
            ) : (
              <div className="mt-5 space-y-4">
                {posts.map((post) => (
                  <article key={post.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                    <p className="text-xs text-slate-500">{timeAgo(post.created_at)}</p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{post.content}</p>

                    {/* New posts carry the whole list; older ones only have
                        the single column. Without this a four-photo post
                        showed only its cover here. */}
                    <div className="mt-3">
                      <PostImages paths={post.image_paths?.length ? post.image_paths : [post.image_path]} />
                    </div>

                    <div className="mt-4 flex items-center gap-5 border-t border-slate-100 pt-3 text-sm text-slate-600">
                      <span className="inline-flex items-center gap-2">
                        <Heart size={16} /> {post.likes_count ?? 0}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <MessageCircle size={16} /> {post.comments_count ?? 0}
                      </span>
                      {/* Without this, a post on someone else's profile is a
                          dead end — you can read it but not like or comment. */}
                      <Link
                        href={`/post/${post.id}`}
                        className="ml-auto font-semibold text-[#B45309] hover:underline"
                      >
                        View post
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
            )
          ) : (
            <div className="mt-5 space-y-4">
              {/* Write or edit your own review */}
              {reviews?.can_review && !writing && (
                <button
                  type="button"
                  onClick={() => { setWriting(true); setReviewError(""); }}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white py-4 text-sm font-bold text-[#0B1F3A] transition hover:border-orange-300 hover:bg-orange-50"
                >
                  <SquarePen size={16} />
                  {reviews.my_review ? "Edit your review" : `Review ${firstName} as a seller`}
                </button>
              )}

              {/* Nothing to explain if they've already reviewed; this is for
                  people who simply haven't dealt with this seller. */}
              {reviews && !reviews.can_review && !reviews.my_review && (
                <p className="rounded-2xl bg-slate-100 p-4 text-xs leading-5 text-slate-600">
                  Only students who have messaged {firstName} about a listing can leave a
                  review. This keeps ratings tied to real deals.
                </p>
              )}

              {writing && (
                <form onSubmit={submitReview} className="rounded-2xl border border-slate-200 bg-white p-5">
                  <p className="text-sm font-bold">How was dealing with {firstName}?</p>

                  <div className="mt-3">
                    <StarPicker value={myRating} onChange={setMyRating} />
                  </div>

                  <label htmlFor="review-comment" className="mt-4 block text-sm font-semibold text-slate-700">
                    Add a comment <span className="font-normal text-slate-500">(optional)</span>
                  </label>
                  <textarea
                    id="review-comment"
                    value={myComment}
                    onChange={(event) => setMyComment(event.target.value)}
                    rows={4}
                    maxLength={500}
                    placeholder="Was the item as described? Did they show up on time?"
                    className="mt-1 w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-base outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 sm:text-sm"
                  />
                  <p className="mt-1 text-right text-xs text-slate-500">{myComment.length}/500</p>

                  {reviewError && (
                    <p role="alert" className="mt-2 rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">
                      {reviewError}
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap justify-end gap-3">
                    {reviews?.my_review && (
                      <button
                        type="button"
                        onClick={() => void removeMyReview()}
                        className="mr-auto inline-flex items-center gap-1.5 text-sm font-bold text-red-700 hover:underline"
                      >
                        <Trash2 size={15} /> Remove
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setWriting(false)}
                      disabled={reviewSaving}
                      className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={reviewSaving}
                      className="rounded-full bg-[#FF7900] px-5 py-2 text-sm font-bold text-[#0B1F3A] disabled:opacity-50"
                    >
                      {reviewSaving ? "Saving..." : reviews?.my_review ? "Update review" : "Post review"}
                    </button>
                  </div>
                </form>
              )}

              {!reviews || reviews.reviews.length === 0 ? (
                <div className="rounded-3xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF3E8] text-[#FF7900]">
                    <Star size={26} strokeWidth={1.8} />
                  </div>
                  <h3 className="mt-4 text-lg font-extrabold">No reviews yet</h3>
                  <p className="mt-2 text-sm text-gray-600">
                    Reviews appear here after students buy from {firstName}.
                  </p>
                </div>
              ) : (
                reviews.reviews.map((review) => {
                  const reviewer = review.reviewer;
                  const mine = reviews.my_review?.id === review.id;

                  return (
                    <article key={review.id} className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
                      <div className="flex items-start gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-100 text-sm font-bold text-orange-700">
                          {reviewer?.avatar_path ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={`${API_ORIGIN}/storage/${reviewer.avatar_path.replace(/^\/+/, "")}`}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            getInitials(reviewer?.name ?? "S")
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="flex flex-wrap items-center gap-2 text-sm font-bold">
                            {reviewer?.id ? (
                              <Link href={`/users/${reviewer.id}`} className="hover:underline">
                                {reviewer.name}
                              </Link>
                            ) : (
                              "Campus Plus student"
                            )}
                            {reviewer?.is_verified && <VerifiedBadge className="h-4 w-4" />}
                            {mine && (
                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600">
                                Your review
                              </span>
                            )}
                          </p>
                          <div className="mt-1 flex items-center gap-2">
                            <Stars value={review.rating} size={14} />
                            <span className="text-xs text-slate-500">{timeAgo(review.created_at)}</span>
                          </div>
                        </div>
                      </div>

                      {review.comment && (
                        <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                          {review.comment}
                        </p>
                      )}
                    </article>
                  );
                })
              )}
            </div>
          )}
        </section>
      </div>

      <BottomNav />
    </main>
  );
}

export default function UserProfilePage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F0F4F9]">
          <p className="font-medium text-[#0B1F3A]">Loading profile...</p>
        </main>
      }
    >
      <UserProfileContent />
    </Suspense>
  );
}