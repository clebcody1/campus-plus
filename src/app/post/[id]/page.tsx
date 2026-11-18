"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { notFound, useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft, Heart, MessageCircle, CornerDownRight, Send, SquarePen, Trash2, Globe2,
} from "lucide-react";
import BottomNav from "@/components/BottomNav";
import VerifiedBadge from "@/components/VerifiedBadge";
import PostImages from "@/components/PostImages";
import { API_URL, storageUrl } from "@/lib/api";

// Past this depth replies stop stepping right, so a long thread never
// squeezes itself off the side of a phone screen.
const MAX_INDENT_DEPTH = 3;

// You can edit a post or comment for five minutes. The server checks this
// too — a phone's clock can be wrong, or deliberately changed.
const EDIT_WINDOW_MS = 5 * 60 * 1000;

const TOKEN_KEY = "campus_life_token";
const USER_KEY = "campus_life_user";

// Diagnostic detail belongs in the console, never on a user's screen. In
// production these calls do nothing, so API addresses and file paths stay
// out of the interface.
function logDev(...args: unknown[]) {
  if (process.env.NODE_ENV !== "production") console.error(...args);
}

type Author = {
  id: number;
  name: string;
  username?: string | null;
  university?: string | null;
  avatar_path?: string | null;
  is_verified?: boolean;
  role?: string | null;
};

type Likeable = {
  liked_by_me?: boolean;
  liked?: boolean;
  is_liked?: boolean;
  liked_by_user?: boolean;
};

type CommentNode = Likeable & {
  id: number;
  user_id?: number;
  content: string;
  created_at: string;
  updated_at?: string;
  parent_id?: number | null;
  likes_count?: number;
  user?: Author | null;
  replies?: CommentNode[];
};

type PostDetail = Likeable & {
  id: number;
  user_id?: number;
  content: string;
  image_path?: string | null;
  image_paths?: string[] | null;
  // The post's own campus, not the author's. NULL means platform-wide.
  university?: string | null;
  created_at: string;
  updated_at?: string;
  likes_count?: number;
  comments_count?: number;
  user?: Author | null;
};

// A fetch that gives up instead of hanging. Without this, an API that never
// answers leaves the page on its spinner with nothing to go on.
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

// The Laravel API returns liked_by_me. The other three are fallbacks in case
// an older endpoint is still answering with a different name.
function readLiked(item: Likeable) {
  return Boolean(item.liked_by_me ?? item.liked ?? item.is_liked ?? item.liked_by_user);
}

// Sets every spelling at once, so whichever one the API later sends back
// still agrees with what is on screen.
function likeFlags(value: boolean): Likeable {
  return { liked_by_me: value, liked: value, is_liked: value, liked_by_user: value };
}

// Laravel bumps updated_at on every save, so a gap of more than a second
// from created_at means the author came back and changed it.
function wasEdited(item: { created_at: string; updated_at?: string }) {
  if (!item.updated_at) return false;
  return new Date(item.updated_at).getTime() - new Date(item.created_at).getTime() > 2000;
}

function withinEditWindow(createdAt: string) {
  const ms = new Date(createdAt).getTime();
  if (Number.isNaN(ms)) return false;
  return Date.now() - ms < EDIT_WINDOW_MS;
}

function timeAgo(dateString: string) {
  const ms = new Date(dateString).getTime();
  if (Number.isNaN(ms)) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 60) return "Just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d`;
  return new Date(dateString).toLocaleDateString();
}

function initialsOf(name?: string | null) {
  return (name || "S").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

// A comment whose content is empty is a tombstone: it was deleted but kept
// so the replies hanging off it don't vanish with it.
function isDeleted(comment: CommentNode) {
  return comment.content.trim() === "";
}

function countThread(list: CommentNode[]): number {
  return list.reduce(
    (total, c) => total + (isDeleted(c) ? 0 : 1) + countThread(c.replies ?? []),
    0,
  );
}

function insertReply(list: CommentNode[], parentId: number, reply: CommentNode): CommentNode[] {
  return list.map((comment) => {
    if (comment.id === parentId) {
      return { ...comment, replies: [...(comment.replies ?? []), reply] };
    }
    if (comment.replies?.length) {
      return { ...comment, replies: insertReply(comment.replies, parentId, reply) };
    }
    return comment;
  });
}

function updateComment(list: CommentNode[], id: number, patch: Partial<CommentNode>): CommentNode[] {
  return list.map((comment) => {
    if (comment.id === id) return { ...comment, ...patch };
    if (comment.replies?.length) {
      return { ...comment, replies: updateComment(comment.replies, id, patch) };
    }
    return comment;
  });
}

// Pulls one comment out of the tree entirely, at any depth.
function removeComment(list: CommentNode[], id: number): CommentNode[] {
  return list
    .filter((comment) => comment.id !== id)
    .map((comment) =>
      comment.replies?.length
        ? { ...comment, replies: removeComment(comment.replies, id) }
        : comment,
    );
}

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";

function Avatar({ user, size = 40 }: { user?: Author | null; size?: number }) {
  const src = storageUrl(user?.avatar_path);
  const [failed, setFailed] = useState(false);

  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#FFF3E8] font-bold text-[#B45309]"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {src && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" onError={() => setFailed(true)} className="h-full w-full object-cover" />
      ) : (
        initialsOf(user?.name)
      )}
    </span>
  );
}

function PostDetail() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const router = useRouter();

  const postId = params?.id;
  // Notifications link here with ?comment=123 so we can highlight that reply.
  const targetCommentId = searchParams.get("comment");

  const [myId, setMyId] = useState<number | null>(null);
  const [post, setPost] = useState<PostDetail | null>(null);
  const [comments, setComments] = useState<CommentNode[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // The post does not exist. notFound() throws an error React only catches
  // during render, so an async handler can't call it directly — it raises
  // this flag instead and the render below acts on it.
  const [missing, setMissing] = useState(false);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  // Which comment the reply box is currently open under.
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [replyDraft, setReplyDraft] = useState("");
  const [replySending, setReplySending] = useState(false);

  // Comment being edited in place.
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [editSaving, setEditSaving] = useState(false);

  // Post editor.
  const [editingPost, setEditingPost] = useState(false);
  const [postDraft, setPostDraft] = useState("");
  const [postSaving, setPostSaving] = useState(false);

  const highlightRef = useRef<HTMLDivElement>(null);

  // Re-render each minute so relative times stay honest and the edit window
  // closes on screen without needing a reload.
  const [, setClock] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => setClock((c) => c + 1), 60000);
    return () => window.clearInterval(id);
  }, []);

  // Who am I? The cached user in localStorage may have no id, depending on
  // what the login response saved — and without an id, Edit and Delete can
  // never appear on your own comments. Read the cache for speed, then
  // confirm with the server, which always returns it.
  useEffect(() => {
    let cancelled = false;

    try {
      const raw = window.localStorage.getItem(USER_KEY);
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed?.id) setMyId(Number(parsed.id));
    } catch {
      // A corrupt cached user just means we wait for the server.
    }

    const token = readToken();
    if (!token) return;

    fetchWithTimeout(`${API_URL}/user`, {
      headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      cache: "no-store",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const user = data?.user ?? data;
        if (!cancelled && user?.id) setMyId(Number(user.id));
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, []);

  const load = useCallback(async () => {
    // useParams is empty on the first client render, and stays empty if the
    // folder isn't named [id]. Either way, never leave the spinner up with
    // no explanation.
    if (!postId) {
      setLoading(false);
      setError("This post could not be found.");
      logDev(
        "No post id in the address. Check that this file is at app/post/[id]/page.tsx — the folder must be [id], exactly.",
      );
      return;
    }

    const token = readToken();
    if (!token) {
      setLoading(false);
      setError("Please log in to see this post.");
      return;
    }

    const headers = { Accept: "application/json", Authorization: `Bearer ${token}` };
    setLoading(true);
    setError("");
    setMissing(false);

    try {
      const [postRes, commentsRes] = await Promise.all([
        fetchWithTimeout(`${API_URL}/posts/${encodeURIComponent(postId)}`, { headers, cache: "no-store" }),
        fetchWithTimeout(`${API_URL}/posts/${encodeURIComponent(postId)}/comments`, { headers, cache: "no-store" }),
      ]);

      // Hand a missing post to the app's shared 404 page rather than
      // showing a one-off message here. The finally block still runs.
      if (postRes.status === 404) {
        setMissing(true);
        return;
      }

      if (postRes.status === 401) throw new Error("Your session has expired. Please log in again.");
      if (!postRes.ok) throw new Error("Could not load this post. Please try again.");

      const postJson = await postRes.json();
      setPost((postJson.data ?? postJson.post ?? postJson) as PostDetail);

      if (commentsRes.ok) {
        const commentJson = await commentsRes.json();
        const list = commentJson.data ?? commentJson.comments?.data ?? commentJson.comments ?? commentJson;
        setComments(Array.isArray(list) ? list : []);
      }
    } catch (err) {
      const timedOut = err instanceof DOMException && err.name === "AbortError";
      logDev(`Failed to load post ${postId} from ${API_URL}`, err);
      setError(
        timedOut
          ? "We couldn't reach the server. Check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Could not load this post.",
      );
    } finally {
      // Runs on every path, so the page can never sit on its spinner.
      setLoading(false);
    }
  }, [postId]);

  useEffect(() => { void load(); }, [load]);

  // Scroll the notification's comment into view once it has rendered.
  useEffect(() => {
    if (!targetCommentId || loading) return;
    const timer = window.setTimeout(() => {
      highlightRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [targetCommentId, loading, comments.length]);

  function mineComment(comment: CommentNode) {
    if (!myId) return false;
    return (comment.user?.id ?? comment.user_id) === myId;
  }

  function minePost() {
    if (!myId || !post) return false;
    return (post.user?.id ?? post.user_id) === myId;
  }

  // ------------------------------------------------------------- likes
  async function togglePostLike() {
    if (!post) return;
    const token = readToken();
    if (!token) {
      setError("Please log in to like posts.");
      return;
    }

    const wasLiked = readLiked(post);
    const previous = post;

    // Update immediately, then reconcile with whatever the server says.
    setPost({
      ...post,
      ...likeFlags(!wasLiked),
      likes_count: Math.max(0, (post.likes_count ?? 0) + (wasLiked ? -1 : 1)),
    });

    try {
      const res = await fetchWithTimeout(`${API_URL}/posts/${post.id}/like`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();

      const result = await res.json().catch(() => ({}));
      setPost((current) =>
        current
          ? {
              ...current,
              ...likeFlags(Boolean(result.liked_by_me ?? !wasLiked)),
              likes_count: Number(result.likes_count ?? current.likes_count ?? 0),
            }
          : current,
      );
    } catch {
      setPost(previous); // put it back if the request failed
    }
  }

  async function toggleCommentLike(comment: CommentNode) {
    const token = readToken();
    if (!token) {
      setError("Please log in to like comments.");
      return;
    }

    const wasLiked = readLiked(comment);

    setComments((current) =>
      updateComment(current, comment.id, {
        ...likeFlags(!wasLiked),
        likes_count: Math.max(0, (comment.likes_count ?? 0) + (wasLiked ? -1 : 1)),
      }),
    );

    try {
      const res = await fetchWithTimeout(`${API_URL}/comments/${comment.id}/like`, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error();

      const result = await res.json().catch(() => ({}));
      setComments((current) =>
        updateComment(current, comment.id, {
          ...likeFlags(Boolean(result.liked_by_me ?? !wasLiked)),
          likes_count: Number(result.likes_count ?? (comment.likes_count ?? 0) + (wasLiked ? -1 : 1)),
        }),
      );
    } catch {
      setComments((current) =>
        updateComment(current, comment.id, {
          ...likeFlags(wasLiked),
          likes_count: comment.likes_count ?? 0,
        }),
      );
    }
  }

  // ------------------------------------------------------- new comments
  async function submitComment(content: string, parentId: number | null) {
    const token = readToken();
    if (!token || !post) throw new Error("Please log in to comment.");

    const res = await fetchWithTimeout(`${API_URL}/posts/${post.id}/comments`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ content, parent_id: parentId }),
    });

    const result = await res.json().catch(() => ({}));

    if (res.status === 401) {
      throw new Error("Your session is not being accepted. Please log out and log in again.");
    }
    if (!res.ok) {
      const validation = result?.errors ? Object.values(result.errors).flat().join(" ") : "";
      throw new Error(validation || result?.message || "Could not post your comment.");
    }

    const created = (result.comment ?? result.data ?? result) as CommentNode;
    return { ...created, replies: created.replies ?? [] };
  }

  async function postTopLevel(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;

    setSending(true);
    setError("");
    try {
      const created = await submitComment(content, null);
      setComments((current) => [...current, created]);
      setDraft("");
      setPost((c) => (c ? { ...c, comments_count: (c.comments_count ?? 0) + 1 } : c));
    } catch (err) {
      logDev("Failed to post comment", err);
      setError(err instanceof Error ? err.message : "Could not post your comment.");
    } finally {
      setSending(false);
    }
  }

  async function postReply(parentId: number) {
    const content = replyDraft.trim();
    if (!content || replySending) return;

    setReplySending(true);
    setError("");
    try {
      const created = await submitComment(content, parentId);
      setComments((current) => insertReply(current, parentId, created));
      setReplyDraft("");
      setReplyTo(null);
      setPost((c) => (c ? { ...c, comments_count: (c.comments_count ?? 0) + 1 } : c));
    } catch (err) {
      logDev("Failed to post reply", err);
      setError(err instanceof Error ? err.message : "Could not post your reply.");
    } finally {
      setReplySending(false);
    }
  }

  // ------------------------------------------------ edit/delete comment
  function startEditComment(comment: CommentNode) {
    setReplyTo(null);
    setEditingId(comment.id);
    setEditDraft(comment.content);
    setError("");
  }

  async function saveCommentEdit(commentId: number) {
    const content = editDraft.trim();
    if (!content || editSaving) return;

    const token = readToken();
    if (!token) {
      setError("Please log in again.");
      return;
    }

    setEditSaving(true);
    setError("");

    try {
      const res = await fetchWithTimeout(`${API_URL}/comments/${commentId}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });

      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        const validation = result?.errors ? Object.values(result.errors).flat().join(" ") : "";
        throw new Error(validation || result?.message || "Could not save your change.");
      }

      setComments((current) =>
        updateComment(current, commentId, {
          content,
          // Far enough past created_at that the "edited" label shows.
          updated_at: new Date(Date.now() + 5000).toISOString(),
        }),
      );
      setEditingId(null);
      setEditDraft("");
    } catch (err) {
      logDev("Failed to save comment edit", err);
      setError(err instanceof Error ? err.message : "Could not save your change.");
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteComment(comment: CommentNode) {
    if (!window.confirm("Delete this comment?")) return;

    const token = readToken();
    if (!token) {
      setError("Please log in again.");
      return;
    }

    const snapshot = comments;
    const hasReplies = (comment.replies ?? []).length > 0;

    // Take it away immediately. A comment with replies underneath becomes a
    // tombstone instead of disappearing, so the replies keep their place.
    setComments((current) =>
      hasReplies
        ? updateComment(current, comment.id, { content: "" })
        : removeComment(current, comment.id),
    );
    setPost((c) => (c ? { ...c, comments_count: Math.max(0, (c.comments_count ?? 1) - 1) } : c));

    try {
      const res = await fetchWithTimeout(`${API_URL}/comments/${comment.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || "Could not delete the comment.");

      // The server decides whether it was removed or tombstoned. If it
      // disagrees with the guess above, follow the server.
      if (result.tombstoned === true && !hasReplies) {
        setComments((current) => updateComment(current, comment.id, { content: "" }));
      } else if (result.tombstoned === false && hasReplies) {
        setComments((current) => removeComment(current, comment.id));
      }
    } catch (err) {
      logDev("Failed to delete comment", err);
      setComments(snapshot);
      setError(err instanceof Error ? err.message : "Could not delete the comment.");
    }
  }

  // --------------------------------------------------- edit/delete post
  function startEditPost() {
    if (!post) return;
    setPostDraft(post.content);
    setEditingPost(true);
    setError("");
  }

  async function savePostEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!post || postSaving) return;

    const content = postDraft.trim();
    if (!content) {
      setError("A post cannot be empty.");
      return;
    }

    const token = readToken();
    if (!token) {
      setError("Please log in again.");
      return;
    }

    setPostSaving(true);
    setError("");

    try {
      const res = await fetchWithTimeout(`${API_URL}/posts/${post.id}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ content }),
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) {
        const validation = result?.errors ? Object.values(result.errors).flat().join(" ") : "";
        throw new Error(validation || result?.message || "Could not save your changes.");
      }

      setPost((c) =>
        c ? { ...c, content, updated_at: new Date(Date.now() + 5000).toISOString() } : c,
      );
      setEditingPost(false);
    } catch (err) {
      logDev("Failed to save post edit", err);
      setError(err instanceof Error ? err.message : "Could not save your changes.");
    } finally {
      setPostSaving(false);
    }
  }

  async function deletePost() {
    if (!post) return;
    if (!window.confirm("Delete this post? This cannot be undone.")) return;

    const token = readToken();
    if (!token) {
      setError("Please log in again.");
      return;
    }

    try {
      const res = await fetchWithTimeout(`${API_URL}/posts/${post.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const result = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(result.message || "Could not delete the post.");
      router.push("/");
    } catch (err) {
      logDev("Failed to delete post", err);
      setError(err instanceof Error ? err.message : "Could not delete the post.");
    }
  }

  // ------------------------------------------------------------ render
  function renderComment(comment: CommentNode, depth: number, parentName?: string) {
    const deleted = isDeleted(comment);
    const liked = readLiked(comment);
    const isTarget = targetCommentId === String(comment.id);
    const indent = Math.min(depth, MAX_INDENT_DEPTH);
    const children = comment.replies ?? [];
    const commenter = comment.user?.name ?? "Campus Plus student";
    const mine = mineComment(comment);
    const editable = mine && !deleted && withinEditWindow(comment.created_at);
    const beingEdited = editingId === comment.id;

    return (
      <div
        key={comment.id}
        ref={isTarget ? highlightRef : undefined}
        style={{ marginLeft: indent * 16 }}
        className={`mt-3 rounded-2xl border p-3 transition ${
          isTarget ? "border-[#FF7900] bg-orange-50/70" : "border-slate-200 bg-white"
        }`}
      >
        <div className="flex gap-3">
          {comment.user?.id && !deleted ? (
            <Link href={`/users/${comment.user.id}`} className="shrink-0">
              <Avatar user={comment.user} size={36} />
            </Link>
          ) : (
            <Avatar user={deleted ? null : comment.user} size={36} />
          )}

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
              {deleted ? (
                <span className="text-sm font-bold text-slate-400">Deleted</span>
              ) : comment.user?.id ? (
                <Link
                  href={`/users/${comment.user.id}`}
                  className="truncate text-sm font-bold text-[#0B1F3A] hover:underline"
                >
                  {commenter}
                </Link>
              ) : (
                <span className="truncate text-sm font-bold text-[#0B1F3A]">{commenter}</span>
              )}

              {!deleted && comment.user?.is_verified && (
                <VerifiedBadge className="h-3.5 w-3.5" admin={comment.user?.role === "admin"} />
              )}

              {!deleted && comment.user?.username && (
                <span className="truncate text-xs text-slate-500">@{comment.user.username}</span>
              )}

              <span className="text-xs text-slate-400">
                · {timeAgo(comment.created_at)}
                {!deleted && wasEdited(comment) ? " · edited" : ""}
              </span>
            </div>

            {/* Past the indent cap, say who is being replied to instead of
                stepping further right. */}
            {depth > MAX_INDENT_DEPTH && parentName && !deleted && (
              <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-[#B45309]">
                <CornerDownRight size={12} aria-hidden="true" /> Replying to {parentName}
              </p>
            )}

            {deleted ? (
              <p className="mt-1 text-sm italic leading-6 text-slate-400">
                This comment was deleted.
              </p>
            ) : beingEdited ? (
              <div className="mt-2">
                <label htmlFor={`edit-${comment.id}`} className="sr-only">Edit your comment</label>
                <textarea
                  id={`edit-${comment.id}`}
                  autoFocus
                  rows={3}
                  maxLength={2000}
                  value={editDraft}
                  onChange={(e) => setEditDraft(e.target.value)}
                  className="w-full resize-none rounded-xl border border-slate-300 px-3 py-2 text-base outline-none transition focus:border-[#FF7900] focus:ring-2 focus:ring-[#FF7900]/25 sm:text-sm"
                />
                <div className="mt-2 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void saveCommentEdit(comment.id)}
                    disabled={editSaving || !editDraft.trim()}
                    className={`rounded-xl bg-[#FF7900] px-4 py-2 text-sm font-bold text-[#0B1F3A] transition hover:bg-[#FF8F26] disabled:opacity-50 ${focus}`}
                  >
                    {editSaving ? "Saving..." : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingId(null); setEditDraft(""); }}
                    disabled={editSaving}
                    className={`rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 disabled:opacity-50 ${focus}`}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                {comment.content}
              </p>
            )}

            {!deleted && !beingEdited && (
              <div className="mt-2 flex flex-wrap items-center gap-4 text-xs">
                <button
                  type="button"
                  onClick={() => void toggleCommentLike(comment)}
                  aria-pressed={liked}
                  className={`inline-flex items-center gap-1.5 font-semibold transition ${
                    liked ? "text-orange-600" : "text-slate-500 hover:text-slate-800"
                  } ${focus}`}
                >
                  <Heart size={14} fill={liked ? "currentColor" : "none"} />
                  {comment.likes_count ?? 0}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setEditingId(null);
                    setReplyTo(replyTo === comment.id ? null : comment.id);
                    setReplyDraft("");
                  }}
                  className={`font-semibold text-slate-500 transition hover:text-slate-800 ${focus}`}
                >
                  Reply{children.length > 0 ? ` · ${children.length}` : ""}
                </button>

                {editable && (
                  <button
                    type="button"
                    onClick={() => startEditComment(comment)}
                    className={`inline-flex items-center gap-1 font-semibold text-slate-500 transition hover:text-[#B45309] ${focus}`}
                  >
                    <SquarePen size={13} /> Edit
                  </button>
                )}

                {mine && (
                  <button
                    type="button"
                    onClick={() => void deleteComment(comment)}
                    className={`inline-flex items-center gap-1 font-semibold text-slate-500 transition hover:text-red-700 ${focus}`}
                  >
                    <Trash2 size={13} /> Delete
                  </button>
                )}
              </div>
            )}

            {replyTo === comment.id && !deleted && (
              <div className="mt-3 flex items-start gap-2">
                <label htmlFor={`reply-${comment.id}`} className="sr-only">Write a reply</label>
                <textarea
                  id={`reply-${comment.id}`}
                  autoFocus
                  rows={2}
                  maxLength={2000}
                  value={replyDraft}
                  onChange={(e) => setReplyDraft(e.target.value)}
                  placeholder={`Reply to ${commenter}...`}
                  className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-base outline-none transition focus:border-[#FF7900] focus:ring-2 focus:ring-[#FF7900]/25 sm:text-sm"
                />
                <button
                  type="button"
                  onClick={() => void postReply(comment.id)}
                  disabled={replySending || !replyDraft.trim()}
                  aria-label="Send reply"
                  className={`shrink-0 rounded-xl bg-[#FF7900] px-3 py-2.5 text-sm font-bold text-[#0B1F3A] transition hover:bg-[#FF8F26] disabled:opacity-50 ${focus}`}
                >
                  <Send size={16} />
                </button>
              </div>
            )}
          </div>
        </div>

        {children.map((child) => renderComment(child, depth + 1, commenter))}
      </div>
    );
  }

  // The post came back 404. Throwing here, during render, is the only place
  // React will catch it and show the app's not-found page.
  if (missing) notFound();

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F0F4F9]">
        <div className="text-center" role="status">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-[#FF7900] border-t-transparent" />
          <p className="text-sm font-medium text-[#0B1F3A]">Loading post…</p>
        </div>
      </main>
    );
  }

  if (error && !post) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#F0F4F9] px-5 pb-24">
        <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-extrabold text-[#0B1F3A]">Post unavailable</h1>
          <p className="mt-3 text-sm leading-6 text-slate-600">{error}</p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => void load()}
              className={`rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 ${focus}`}
            >
              Try again
            </button>
            <Link
              href="/"
              className={`inline-flex rounded-xl bg-[#FF7900] px-5 py-3 text-sm font-bold text-[#0B1F3A] ${focus}`}
            >
              Back to feed
            </Link>
          </div>
        </div>
        <BottomNav />
      </main>
    );
  }

  if (!post) return null;

  const liked = readLiked(post);
  const totalComments = countThread(comments);
  const poster = post.user?.name ?? "Campus Plus student";
  const postEditable = minePost() && withinEditWindow(post.created_at);

  /*
   | A NULL campus on the post itself means it was published platform-wide,
   | which only an admin can do.
   |
   | Strict === null on purpose: an older build of the API that doesn't send
   | the field at all gives undefined, and undefined must not be read as
   | "show this to everyone".
   */
  const platformWide = post.university === null;

  return (
    <main className="min-h-screen bg-[#F0F4F9] pb-28 text-[#0B1F3A] lg:pb-12">
      <header className="sticky top-0 z-30 bg-white shadow-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Go back"
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-700 transition hover:bg-slate-100 ${focus}`}
          >
            <ArrowLeft size={23} strokeWidth={2} />
          </button>
          <h1 className="text-xl font-extrabold">Post</h1>
        </div>
      </header>

      <section className="mx-auto max-w-2xl px-4 py-5 sm:px-6">
        <article className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="flex items-center gap-3">
            {post.user?.id ? (
              <Link href={`/users/${post.user.id}`}>
                <Avatar user={post.user} size={44} />
              </Link>
            ) : (
              <Avatar user={post.user} size={44} />
            )}

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                {post.user?.id ? (
                  <Link href={`/users/${post.user.id}`} className="truncate font-bold hover:underline">
                    {poster}
                  </Link>
                ) : (
                  <span className="truncate font-bold">{poster}</span>
                )}
                {post.user?.is_verified && (
                  <VerifiedBadge className="h-4 w-4" admin={post.user?.role === "admin"} />
                )}

                {/* Published to every campus, not just this one. Without it
                    an announcement looks like it came from one student at
                    your own school. */}
                {platformWide && (
                  <span
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600"
                    title="Posted to every school on Campus Plus"
                  >
                    <Globe2 size={10} aria-hidden="true" />
                    All schools
                  </span>
                )}
              </div>
              <p className="truncate text-xs text-slate-500">
                {/* The author's own school is misleading on a platform-wide
                    post: it is not a message from LAUTECH, it is a message
                    from Campus Plus. */}
                {platformWide
                  ? "Campus Plus · "
                  : post.user?.university
                    ? `${post.user.university} · `
                    : ""}
                {timeAgo(post.created_at)}
                {wasEdited(post) ? " · edited" : ""}
              </p>
            </div>

            {minePost() && !editingPost && (
              <div className="flex shrink-0 items-center gap-1">
                {postEditable && (
                  <button
                    type="button"
                    onClick={startEditPost}
                    aria-label="Edit post"
                    className={`rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-[#B45309] ${focus}`}
                  >
                    <SquarePen size={17} />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => void deletePost()}
                  aria-label="Delete post"
                  className={`rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-700 ${focus}`}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            )}
          </div>

          {editingPost ? (
            <form onSubmit={savePostEdit} className="mt-4">
              <label htmlFor="edit-post" className="sr-only">Edit your post</label>
              <textarea
                id="edit-post"
                autoFocus
                rows={5}
                maxLength={5000}
                value={postDraft}
                onChange={(e) => setPostDraft(e.target.value)}
                className="w-full resize-y rounded-xl border border-slate-300 px-4 py-3 text-base outline-none transition focus:border-[#FF7900] focus:ring-2 focus:ring-[#FF7900]/25 sm:text-sm"
              />
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={postSaving || !postDraft.trim()}
                  className={`rounded-xl bg-[#FF7900] px-5 py-2.5 text-sm font-bold text-[#0B1F3A] transition hover:bg-[#FF8F26] disabled:opacity-50 ${focus}`}
                >
                  {postSaving ? "Saving..." : "Save changes"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPost(false)}
                  disabled={postSaving}
                  className={`rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 disabled:opacity-50 ${focus}`}
                >
                  Cancel
                </button>
                <span className="ml-auto text-xs text-slate-400">{postDraft.length}/5000</span>
              </div>
            </form>
          ) : (
            <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-7 text-slate-800">
              {post.content}
            </p>
          )}

          {/* New posts carry the whole list; older ones only have the single
              column. */}
          <div className="mt-4">
            <PostImages paths={post.image_paths?.length ? post.image_paths : [post.image_path]} />
          </div>

          <div className="mt-4 flex items-center gap-6 border-t border-slate-100 pt-3 text-sm">
            <button
              type="button"
              onClick={() => void togglePostLike()}
              aria-pressed={liked}
              aria-label={liked ? "Unlike post" : "Like post"}
              className={`inline-flex items-center gap-2 font-semibold transition ${
                liked ? "text-orange-600" : "text-slate-600 hover:text-slate-900"
              } ${focus}`}
            >
              <Heart size={18} fill={liked ? "currentColor" : "none"} />
              {post.likes_count ?? 0}
            </button>

            <span className="inline-flex items-center gap-2 text-slate-600">
              <MessageCircle size={18} />
              {totalComments || post.comments_count || 0}
            </span>
          </div>
        </article>

        {/* Comment box */}
        <form
          onSubmit={postTopLevel}
          className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <label htmlFor="new-comment" className="mb-2 block text-sm font-bold">Add a comment</label>
          <div className="flex items-start gap-2">
            <textarea
              id="new-comment"
              rows={2}
              maxLength={2000}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Say something..."
              className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 px-3 py-2 text-base outline-none transition focus:border-[#FF7900] focus:ring-2 focus:ring-[#FF7900]/25 sm:text-sm"
            />
            <button
              type="submit"
              disabled={sending || !draft.trim()}
              className={`shrink-0 rounded-xl bg-[#FF7900] px-4 py-2.5 text-sm font-bold text-[#0B1F3A] transition hover:bg-[#FF8F26] disabled:opacity-50 ${focus}`}
            >
              {sending ? "..." : "Post"}
            </button>
          </div>
          {error && (
            <p role="alert" className="mt-2 text-xs font-semibold text-red-700">{error}</p>
          )}
          <p className="mt-2 text-xs text-slate-500">
            Be respectful. You can edit or delete your comment for 5 minutes.
          </p>
        </form>

        {/* Thread */}
        <div className="mt-5">
          <h2 className="px-1 text-sm font-bold text-slate-600">
            {totalComments === 0
              ? "No comments yet"
              : `${totalComments} ${totalComments === 1 ? "comment" : "comments"}`}
          </h2>

          {comments.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
              Be the first to comment on this post.
            </p>
          ) : (
            comments.filter((c) => !c.parent_id).map((c) => renderComment(c, 0))
          )}
        </div>
      </section>

      <BottomNav />
    </main>
  );
}

// useSearchParams has to sit inside a Suspense boundary, or the production
// build fails while prerendering this route.
export default function PostDetailPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#F0F4F9]">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#FF7900] border-t-transparent" />
        </main>
      }
    >
      <PostDetail />
    </Suspense>
  );
}