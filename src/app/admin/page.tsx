"use client";

import Link from "next/link";
import { useEffect, useState, type ComponentProps, type ReactNode } from "react";
import {
  LayoutDashboard, Users, FileText, CalendarDays, UserRound, Heart, MessageCircle,
  Trash2, RefreshCw, ChevronLeft, ChevronRight, ShieldCheck, AlertCircle, CheckCircle2,
  X, LoaderCircle, GraduationCap, ArrowUpRight, Flag, ArrowLeft, ShoppingBag, Megaphone,
  MessageSquare, Bug, Lightbulb, type LucideIcon,
} from "lucide-react";

import MarketplaceReportsPanel from "@/components/MarketplaceReportsPanel";
import BrandMark from "@/components/BrandMark";
import { API_URL, storageUrl } from "@/lib/api";

type Person = { id?: number; name?: string; email?: string; university?: string };

type Application = Person & {
  id: number;
  user_id?: number;
  status?: string;
  created_at?: string;
  user?: Person;
};

/** A student asking for permission to post campus updates. */
type RepApplication = {
  id: number;
  position: string;
  faculty: string;
  department: string;
  level: string | null;
  evidence: string;
  status: string;
  created_at?: string;
  user?: Person & { is_verified?: boolean };
};

/** A bug report or suggestion sent from the app. */
type FeedbackItem = {
  id: number;
  type: "bug" | "idea" | "other" | string;
  message: string;
  page?: string | null;
  user_agent?: string | null;
  status: "new" | "seen" | "done" | string;
  admin_notes?: string | null;
  created_at?: string;
  user?: Person | null;
};

type Post = {
  id: number;
  content: string;
  image_path?: string | null;
  created_at?: string;
  likes_count?: number;
  comments_count?: number;
  user?: Person | null;
};

type PostComment = {
  id: number;
  content?: string;
  created_at?: string;
  user?: { name?: string; university?: string } | null;
  parent_id?: number | null;
};

type PostReport = {
  id: number;
  post_id: number;
  user_id: number;
  reason: string;
  details?: string | null;
  status: "pending" | "reviewed" | "dismissed" | string;
  created_at?: string;
  post?: { id?: number; content?: string; user?: { name?: string; university?: string } | null } | null;
  user?: { name?: string; email?: string } | null;
};

type AdminUser = { id: number; name?: string; email?: string; university?: string; role?: string; created_at?: string; organized_events_count?: number; event_attendances_count?: number };
type AdminEvent = { id: number; title?: string; name?: string; category?: string; venue?: string; campus?: string; starts_at?: string; start_date?: string; date?: string; status?: string; attendees_count?: number; organizer?: { name?: string } | null };

type PageTab = "home" | "approvals" | "reps" | "feedback" | "posts" | "users" | "events" | "reports" | "market";

const TABS: { id: PageTab; label: string; icon: LucideIcon; title: string; blurb: string }[] = [
  { id: "home", label: "Home", icon: LayoutDashboard, title: "Dashboard", blurb: "Manage campus content and organizer requests." },
  { id: "approvals", label: "Approvals", icon: ShieldCheck, title: "Organizer approvals", blurb: "Review students who asked to organize events." },
  { id: "reps", label: "Reps", icon: Megaphone, title: "Update posters", blurb: "Approve the reps allowed to post campus updates." },
  { id: "feedback", label: "Feedback", icon: MessageSquare, title: "Student feedback", blurb: "Bugs and ideas sent in from the app." },
  { id: "posts", label: "Posts", icon: FileText, title: "Posts", blurb: "Review content, likes and comments, and remove inappropriate posts." },
  { id: "reports", label: "Reports", icon: Flag, title: "Reported posts", blurb: "Review posts students have flagged." },
  { id: "market", label: "Market", icon: ShoppingBag, title: "Marketplace reports", blurb: "Review reported listings and sellers, and remove them." },
  { id: "users", label: "Users", icon: Users, title: "Users", blurb: "Manage student accounts." },
  { id: "events", label: "Events", icon: CalendarDays, title: "Events", blurb: "Manage campus events." },
];

// Five is the most that fits across a phone alongside Profile. Posts and
// Feedback stay reachable from the Home tools list.
const MOBILE_TABS: PageTab[] = ["home", "approvals", "reps", "reports", "market"];

const REASONS: Record<string, string> = {
  spam: "Spam",
  harassment: "Harassment",
  inappropriate_content: "Inappropriate content",
  misinformation: "Misinformation",
  other: "Other",
};

const REP_POSITIONS: Record<string, string> = {
  course_rep: "Course Rep",
  class_rep: "Class Rep",
  sug: "SUG Executive",
  press: "Departmental Press",
  other: "Other",
};

const FEEDBACK_TYPES: Record<string, { label: string; icon: LucideIcon }> = {
  bug: { label: "Bug", icon: Bug },
  idea: { label: "Idea", icon: Lightbulb },
  other: { label: "Other", icon: MessageSquare },
};

/* ---------- small UI building blocks ---------- */

const focus = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]";

const BTN = {
  primary: "bg-[#FF7900] text-[#0B1F3A] hover:bg-[#FF8F26]",
  secondary: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
  danger: "border border-red-300 bg-white text-red-700 hover:bg-red-50",
  dark: "bg-[#0B1F3A] text-white hover:bg-[#17385F]",
} as const;

function Btn({
  variant = "secondary", className = "", ...props
}: ComponentProps<"button"> & { variant?: keyof typeof BTN }) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${focus} ${BTN[variant]} ${className}`}
    />
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</div>;
}

function Spinner({ label }: { label: string }) {
  return (
    <Card className="flex items-center justify-center gap-2 p-10 text-sm text-slate-600">
      <LoaderCircle size={20} className="animate-spin text-[#FF7900]" /> {label}
    </Card>
  );
}

function Empty({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text: string }) {
  return (
    <Card className="px-6 py-14 text-center">
      <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-orange-50 text-[#FF7900]">
        <Icon size={26} />
      </span>
      <h2 className="mt-4 text-lg font-bold">{title}</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-slate-600">{text}</p>
    </Card>
  );
}

function Badge({ tone, children }: { tone: "orange" | "green" | "gray" | "red"; children: ReactNode }) {
  const tones = {
    orange: "bg-orange-50 text-[#B45309] ring-orange-200",
    green: "bg-green-50 text-green-800 ring-green-200",
    gray: "bg-slate-100 text-slate-700 ring-slate-200",
    red: "bg-red-50 text-red-700 ring-red-200",
  };
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ring-1 ring-inset ${tones[tone]}`}>{children}</span>;
}

function Avatar({ name }: { name?: string }) {
  const initials = (name || "?").trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-orange-100 text-sm font-bold text-orange-800">
      {initials}
    </span>
  );
}

function Toast({ tone, onClose, children }: { tone: "error" | "success"; onClose: () => void; children: ReactNode }) {
  const error = tone === "error";
  const Icon = error ? AlertCircle : CheckCircle2;
  return (
    <div
      role={error ? "alert" : "status"}
      className={`flex items-start gap-3 rounded-xl border p-4 text-sm shadow-lg ${
        error ? "border-red-200 bg-red-50 text-red-800" : "border-green-200 bg-green-50 text-green-900"
      }`}
    >
      <Icon size={18} className="mt-0.5 shrink-0" />
      <p className="flex-1 font-medium">{children}</p>
      <button onClick={onClose} aria-label="Dismiss" className={`rounded ${focus}`}><X size={16} /></button>
    </div>
  );
}

function formatDate(value?: string) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleString("en-NG", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });
}

/* ---------- page ---------- */

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<PageTab>("home");

  // Who am I? Used to stop an admin deleting their own account.
  const [meId, setMeId] = useState<number | null>(null);

  const [applications, setApplications] = useState<Application[]>([]);
  const [applicationsLoading, setApplicationsLoading] = useState(true);

  const [repApplications, setRepApplications] = useState<RepApplication[]>([]);
  const [repsLoading, setRepsLoading] = useState(false);
  const [repUpdatingId, setRepUpdatingId] = useState<number | null>(null);

  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [feedbackLoading, setFeedbackLoading] = useState(false);
  const [feedbackNewCount, setFeedbackNewCount] = useState(0);
  const [feedbackUpdatingId, setFeedbackUpdatingId] = useState<number | null>(null);
  const [feedbackFilter, setFeedbackFilter] = useState<"all" | "new" | "seen" | "done">("all");

  const [posts, setPosts] = useState<Post[]>([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [postsPage, setPostsPage] = useState(1);
  const [postsLastPage, setPostsLastPage] = useState(1);

  const [reports, setReports] = useState<PostReport[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersPage, setUsersPage] = useState(1);
  const [usersLastPage, setUsersLastPage] = useState(1);
  const [userSearch, setUserSearch] = useState("");
  const [userRoleFilter, setUserRoleFilter] = useState("all");
  const [userUniversityFilter, setUserUniversityFilter] = useState("all");
  const [deletingUserId, setDeletingUserId] = useState<number | null>(null);
  const [adminEvents, setAdminEvents] = useState<AdminEvent[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsPage, setEventsPage] = useState(1);
  const [eventsLastPage, setEventsLastPage] = useState(1);
  const [eventSearch, setEventSearch] = useState("");
  const [eventOrganizerFilter, setEventOrganizerFilter] = useState("all");
  const [eventStatusFilter, setEventStatusFilter] = useState("all");
  const [eventCategoryFilter, setEventCategoryFilter] = useState("all");
  const [eventCampusFilter, setEventCampusFilter] = useState("all");

  const [reportStatusUpdatingId, setReportStatusUpdatingId] = useState<number | null>(null);
  const [marketPending, setMarketPending] = useState(0);

  const [commentsByPost, setCommentsByPost] = useState<Record<number, PostComment[]>>({});
  const [expandedPostId, setExpandedPostId] = useState<number | null>(null);
  const [commentsLoadingId, setCommentsLoadingId] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  function getToken() {
    return localStorage.getItem("campus_life_token");
  }

  function accessError(status: number, fallback: string) {
    if (status === 403) return "Your account does not have admin permission.";
    if (status === 401) return "Your session has expired. Please log in again.";
    return fallback;
  }

  async function loadApplications() {
    setApplicationsLoading(true);
    setError("");
    const token = getToken();
    if (!token) {
      setError("Please log in with your admin account.");
      setApplicationsLoading(false);
      return;
    }
    try {
      const response = await fetch(`${API_URL}/admin/organizer-applications`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(accessError(response.status, "Could not load organizer applications."));
      const data = await response.json();
      setApplications(Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setApplicationsLoading(false);
    }
  }

  async function updateApplication(id: number, action: "approve" | "reject") {
    const token = getToken();
    if (!token) {
      setError("Please log in again.");
      return;
    }
    setUpdatingId(id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/admin/organizer-applications/${id}/${action}`, {
        method: "PATCH",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Could not ${action} this application.`);
      setNotice(action === "approve" ? "Organizer application approved." : "Organizer application rejected.");
      await loadApplications();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setUpdatingId(null);
    }
  }

  /* ---------- rep requests ---------- */

  async function loadRepApplications() {
    const token = getToken();
    if (!token) {
      setError("Please log in with your admin account.");
      return;
    }
    setRepsLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/admin/rep-applications`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(accessError(response.status, "Could not load rep requests."));
      const data = await response.json();
      setRepApplications(Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load rep requests.");
    } finally {
      setRepsLoading(false);
    }
  }

  /**
   * Approving grants posting rights locked to the faculty, department and
   * level on the request — a 300L rep can only ever post to 300L, and no
   * rep can mark anything urgent.
   */
  async function updateRepApplication(id: number, action: "approve" | "reject") {
    const token = getToken();
    if (!token) {
      setError("Please log in again.");
      return;
    }

    let notes: string | null = null;
    if (action === "reject") {
      notes = window.prompt("Reason for rejecting (the student will see this):") ?? null;
      if (notes === null) return; // cancelled
    }

    setRepUpdatingId(id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/admin/rep-applications/${id}/${action}`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ admin_notes: notes }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || `Could not ${action} this request.`);
      setNotice(
        action === "approve"
          ? "Rep approved — they can now post updates for their department."
          : "Request rejected."
      );
      setRepApplications((previous) => previous.filter((item) => item.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setRepUpdatingId(null);
    }
  }

  /* ---------- feedback ---------- */

  async function loadFeedback() {
    const token = getToken();
    if (!token) {
      setError("Please log in with your admin account.");
      return;
    }
    setFeedbackLoading(true);
    setError("");
    try {
      const response = await fetch(`${API_URL}/admin/feedback`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(accessError(response.status, "Could not load feedback."));
      const data = await response.json();
      setFeedback(Array.isArray(data.feedback) ? data.feedback : []);
      setFeedbackNewCount(Number(data.new_count ?? 0));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load feedback.");
    } finally {
      setFeedbackLoading(false);
    }
  }

  async function updateFeedbackStatus(id: number, status: "new" | "seen" | "done") {
    const token = getToken();
    if (!token) {
      setError("Please log in again.");
      return;
    }
    setFeedbackUpdatingId(id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/admin/feedback/${id}/status`, {
        method: "PATCH",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not update this feedback.");

      setFeedback((previous) =>
        previous.map((item) => (item.id === id ? { ...item, status } : item))
      );
      // Keep the badge honest without another round trip.
      setFeedbackNewCount((previous) =>
        status === "new" ? previous + 1 : Math.max(0, previous - 1)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this feedback.");
    } finally {
      setFeedbackUpdatingId(null);
    }
  }

  async function deleteFeedback(item: FeedbackItem) {
    if (!window.confirm("Delete this feedback? This cannot be undone.")) return;

    const token = getToken();
    if (!token) {
      setError("Please log in again.");
      return;
    }
    setFeedbackUpdatingId(item.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/admin/feedback/${item.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not delete this feedback.");

      setFeedback((previous) => previous.filter((row) => row.id !== item.id));
      if (item.status === "new") setFeedbackNewCount((previous) => Math.max(0, previous - 1));
      setNotice("Feedback deleted.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this feedback.");
    } finally {
      setFeedbackUpdatingId(null);
    }
  }

  async function loadPosts(page = 1) {
    const token = getToken();
    if (!token) {
      setError("Please log in with your admin account.");
      return;
    }
    setPostsLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/admin/posts?page=${page}`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(accessError(response.status, "Could not load posts."));
      const data = await response.json();
      setPosts(Array.isArray(data) ? data : data.data ?? []);
      setPostsPage(data.current_page ?? page);
      setPostsLastPage(data.last_page ?? 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load posts.");
    } finally {
      setPostsLoading(false);
    }
  }

  async function loadReports() {
    const token = getToken();
    if (!token) {
      setError("Please log in with your admin account.");
      return;
    }
    setReportsLoading(true);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/admin/reports`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(accessError(response.status, "Could not load post reports."));
      const data = await response.json();
      setReports(Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load post reports.");
    } finally {
      setReportsLoading(false);
    }
  }

  async function loadAdminUsers(page = 1) {
    const token = getToken();
    if (!token) { setError("Please log in with your admin account."); return; }
    setUsersLoading(true); setError("");
    try {
      const response = await fetch(`${API_URL}/admin/users?page=${page}`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) throw new Error(accessError(response.status, "Could not load users."));
      const data = await response.json();
      setAdminUsers(Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : []);
      setUsersPage(data.current_page ?? page); setUsersLastPage(data.last_page ?? 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load users."); }
    finally { setUsersLoading(false); }
  }

  async function loadAdminEvents(page = 1) {
    const token = getToken();
    if (!token) { setError("Please log in with your admin account."); return; }
    setEventsLoading(true); setError("");
    try {
      const response = await fetch(`${API_URL}/admin/events?page=${page}`, { headers: { Accept: "application/json", Authorization: `Bearer ${token}` }, cache: "no-store" });
      if (!response.ok) throw new Error(accessError(response.status, "Could not load events."));
      const data = await response.json();
      setAdminEvents(Array.isArray(data) ? data : Array.isArray(data.data) ? data.data : []);
      setEventsPage(data.current_page ?? page); setEventsLastPage(data.last_page ?? 1);
    } catch (err) { setError(err instanceof Error ? err.message : "Could not load events."); }
    finally { setEventsLoading(false); }
  }

  /**
   * Permanently delete a student account.
   * Guarded so an admin can never remove themselves or another admin.
   */
  async function deleteUser(user: AdminUser) {
    const role = (user.role ?? "student").toLowerCase();

    if (meId !== null && user.id === meId) {
      setError("You cannot delete your own account.");
      return;
    }
    if (role === "admin") {
      setError("Admin accounts cannot be deleted from here.");
      return;
    }

    const confirmed = window.confirm(
      `Delete ${user.name ?? "this student"} (${user.email ?? "no email"})?\n\n` +
      "This removes their account along with their posts, listings and messages. It cannot be undone."
    );
    if (!confirmed) return;

    const token = getToken();
    if (!token) {
      setError("Please log in again.");
      return;
    }

    setDeletingUserId(user.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/admin/users/${user.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || accessError(response.status, "Could not delete this user."));

      setAdminUsers((previous) => previous.filter((item) => item.id !== user.id));
      setNotice(`${user.name ?? "That account"} has been deleted.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this user.");
    } finally {
      setDeletingUserId(null);
    }
  }

  async function updateReportStatus(reportId: number, status: "reviewed" | "dismissed") {
    const token = getToken();
    if (!token) {
      setError("Please log in again.");
      return;
    }
    setReportStatusUpdatingId(reportId);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/admin/reports/${reportId}/status`, {
        method: "PATCH",
        headers: { Accept: "application/json", "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not update this report.");
      setReports((previous) => previous.map((r) => (r.id === reportId ? { ...r, status } : r)));
      setNotice(status === "reviewed" ? "Report marked as reviewed." : "Report dismissed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update this report.");
    } finally {
      setReportStatusUpdatingId(null);
    }
  }

  async function toggleComments(postId: number) {
    if (expandedPostId === postId) {
      setExpandedPostId(null);
      return;
    }
    setExpandedPostId(postId);
    if (commentsByPost[postId]) return;

    const token = getToken();
    if (!token) {
      setError("Please log in again.");
      return;
    }
    setCommentsLoadingId(postId);
    setError("");
    try {
      const response = await fetch(`${API_URL}/posts/${postId}/comments`, {
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        cache: "no-store",
      });
      if (!response.ok) throw new Error("Could not load comments for this post.");
      const data = await response.json();
      const comments = Array.isArray(data)
        ? data
        : Array.isArray(data.data) ? data.data : Array.isArray(data.comments) ? data.comments : [];
      setCommentsByPost((previous) => ({ ...previous, [postId]: comments }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load comments.");
    } finally {
      setCommentsLoadingId(null);
    }
  }

  async function deletePost(post: Post) {
    const confirmed = window.confirm(
      `Delete this post by ${post.user?.name ?? "Unknown user"}? This action cannot be undone.`
    );
    if (!confirmed) return;

    const token = getToken();
    if (!token) {
      setError("Please log in again.");
      return;
    }
    setDeletingId(post.id);
    setError("");
    setNotice("");
    try {
      const response = await fetch(`${API_URL}/admin/posts/${post.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.message || "Could not delete this post.");

      setPosts((previous) => previous.filter((item) => item.id !== post.id));
      setReports((previous) => previous.filter((report) => report.post_id !== post.id));
      setCommentsByPost((previous) => {
        const next = { ...previous };
        delete next[post.id];
        return next;
      });
      setExpandedPostId(null);
      setNotice("Post deleted successfully.");
      await loadPosts(postsPage);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this post.");
    } finally {
      setDeletingId(null);
    }
  }

  function getImageUrl(path?: string | null) {
    return storageUrl(path);
  }

  useEffect(() => {
    try {
      const raw = localStorage.getItem("campus_life_user");
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && Number.isFinite(Number(parsed.id))) setMeId(Number(parsed.id));
    } catch {
      // A corrupt cached user just means the self-delete guard falls back to the server.
    }
    loadApplications();
    // Loaded up front so the Reps and Feedback badges are accurate before you
    // open either tab.
    loadRepApplications();
    loadFeedback();
  }, []);

  useEffect(() => {
    if (activeTab === "reps") loadRepApplications();
    if (activeTab === "feedback") loadFeedback();
    if (activeTab === "posts") loadPosts(1);
    if (activeTab === "reports") loadReports();
    if (activeTab === "users") loadAdminUsers(1);
    if (activeTab === "events") loadAdminEvents(1);
  }, [activeTab]);

  /* ---------- derived UI state ---------- */

  const busy = postsLoading || applicationsLoading || reportsLoading || usersLoading || eventsLoading || repsLoading || feedbackLoading;
  const pendingReports = reports.filter((r) => r.status === "pending").length;
  const current = TABS.find((t) => t.id === activeTab)!;
  const badgeFor = (id: PageTab) =>
    id === "approvals" ? applications.length
      : id === "reps" ? repApplications.length
      : id === "feedback" ? feedbackNewCount
      : id === "reports" ? pendingReports
      : id === "market" ? marketPending
      : 0;

  const visibleFeedback = feedback.filter(
    (item) => feedbackFilter === "all" || item.status === feedbackFilter
  );

  function refresh() {
    if (activeTab === "posts") loadPosts(postsPage);
    else if (activeTab === "reps") loadRepApplications();
    else if (activeTab === "feedback") loadFeedback();
    else if (activeTab === "reports") loadReports();
    else if (activeTab === "users") loadAdminUsers(usersPage);
    else if (activeTab === "events") loadAdminEvents(eventsPage);
    else loadApplications();
  }

  function NavButton({ id, mobile = false }: { id: PageTab; mobile?: boolean }) {
    const tab = TABS.find((t) => t.id === id)!;
    const Icon = tab.icon;
    const active = activeTab === id;
    const count = badgeFor(id);

    if (mobile) {
      return (
        <button
          onClick={() => setActiveTab(id)}
          aria-current={active ? "page" : undefined}
          className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1 text-xs font-semibold ${focus} ${
            active ? "text-[#0B1F3A]" : "text-slate-500"
          }`}
        >
          <span className={`relative flex h-8 w-14 items-center justify-center rounded-full transition ${active ? "bg-[#FF7900]" : ""}`}>
            <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
            {count > 0 && (
              <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-[#0B1F3A] px-1 text-[10px] font-bold text-white">
                {count}
              </span>
            )}
          </span>
          {tab.label}
        </button>
      );
    }

    return (
      <button
        onClick={() => setActiveTab(id)}
        aria-current={active ? "page" : undefined}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition ${focus} ${
          active ? "bg-[#0B1F3A] text-white" : "text-slate-600 hover:bg-slate-100"
        }`}
      >
        <Icon size={19} strokeWidth={1.8} aria-hidden="true" />
        {tab.label}
        {count > 0 && (
          <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-bold ${active ? "bg-[#FF7900] text-[#0B1F3A]" : "bg-orange-100 text-[#B45309]"}`}>
            {count}
          </span>
        )}
      </button>
    );
  }

  // Treat values that differ only by letter case as the same filter option.
  const normalizeFilterValue = (value: string) => value.trim().toLocaleLowerCase();
  const displayFilterValue = (value: string) => normalizeFilterValue(value) === "lautech" ? "LAUTECH" : value.trim();
  const uniqueFilterValues = (values: (string | undefined)[]) => {
    const byNormalizedValue = new Map<string, string>();
    values.filter((value): value is string => Boolean(value?.trim())).forEach((value) => {
      const normalized = normalizeFilterValue(value);
      if (!byNormalizedValue.has(normalized)) byNormalizedValue.set(normalized, displayFilterValue(value));
    });
    return Array.from(byNormalizedValue.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  };

  const filteredAdminUsers = adminUsers.filter((user) => {
    const query = userSearch.trim().toLowerCase();
    const matchesSearch = !query || `${user.name ?? ""} ${user.email ?? ""}`.toLowerCase().includes(query);
    const matchesRole = userRoleFilter === "all" || (user.role ?? "student").toLowerCase() === userRoleFilter;
    const matchesUniversity = userUniversityFilter === "all" || normalizeFilterValue(user.university ?? "University not provided") === normalizeFilterValue(userUniversityFilter);
    return matchesSearch && matchesRole && matchesUniversity;
  });
  const userUniversities = uniqueFilterValues(adminUsers.map((user) => user.university));
  const filteredAdminEvents = adminEvents.filter((event) => {
    const title = event.title ?? event.name ?? `Event #${event.id}`;
    const query = eventSearch.trim().toLowerCase();
    const matchesSearch = !query || title.toLowerCase().includes(query);
    const matchesOrganizer = eventOrganizerFilter === "all" || normalizeFilterValue(event.organizer?.name ?? "Unknown organizer") === normalizeFilterValue(eventOrganizerFilter);
    const matchesStatus = eventStatusFilter === "all" || (event.status ?? "scheduled").toLowerCase() === eventStatusFilter;
    const matchesCategory = eventCategoryFilter === "all" || normalizeFilterValue(event.category ?? "Campus event") === normalizeFilterValue(eventCategoryFilter);
    const matchesCampus = eventCampusFilter === "all" || normalizeFilterValue(event.campus ?? "Campus not specified") === normalizeFilterValue(eventCampusFilter);
    return matchesSearch && matchesOrganizer && matchesStatus && matchesCategory && matchesCampus;
  });
  const eventOrganizers = uniqueFilterValues(adminEvents.map((event) => event.organizer?.name));
  const eventStatuses = Array.from(new Set(adminEvents.map((event) => (event.status ?? "scheduled").toLowerCase()))).sort();
  const eventCategories = uniqueFilterValues(adminEvents.map((event) => event.category));
  const eventCampuses = uniqueFilterValues(adminEvents.map((event) => event.campus));

  return (
    <div className="min-h-screen bg-slate-50 text-[#0B1F3A]">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-slate-200 bg-white p-4 lg:flex">
        <Link href="/" className={`mb-6 flex items-center gap-3 rounded-lg px-2 py-1 ${focus}`}>
          <BrandMark size={40} className="shrink-0 rounded-xl" />
          <span>
            <span className="block text-lg font-extrabold leading-5 tracking-tight">
              Campus <span className="text-[#FF7900]">Plus</span>
            </span>
            <span className="text-xs font-semibold text-slate-500">Admin</span>
          </span>
        </Link>

        <nav aria-label="Admin sections" className="space-y-1">
          {TABS.map((t) => <NavButton key={t.id} id={t.id} />)}

          {/* Its own page, not a tab. */}
          <Link
            href="/admin/services"
            className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-100 ${focus}`}
          >
            <ShoppingBag size={19} strokeWidth={1.8} aria-hidden="true" />
            Promotions
          </Link>
        </nav>

        <div className="mt-auto space-y-1 border-t border-slate-200 pt-4">
          <Link href="/profile" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 ${focus}`}>
            <UserRound size={19} strokeWidth={1.8} /> Profile
          </Link>
          <Link href="/" className={`flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 ${focus}`}>
            <ArrowLeft size={19} strokeWidth={1.8} /> Back to Campus Plus
          </Link>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center gap-2">
          <BrandMark size={36} className="shrink-0 rounded-xl" />
          <p className="font-extrabold tracking-tight">Admin</p>
        </div>
        <Link href="/profile" aria-label="Profile" className={`flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 ${focus}`}>
          <UserRound size={18} />
        </Link>
      </header>

      {/* Toasts */}
      {(error || notice) && (
        <div className="fixed inset-x-0 top-16 z-50 mx-auto w-full max-w-md space-y-2 px-4 lg:left-64 lg:top-6">
          {error && <Toast tone="error" onClose={() => setError("")}>{error}</Toast>}
          {notice && <Toast tone="success" onClose={() => setNotice("")}>{notice}</Toast>}
        </div>
      )}

      <main className="px-4 pb-28 pt-6 sm:px-6 lg:pb-12 lg:pl-[calc(16rem+2.5rem)] lg:pr-10 lg:pt-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">{current.title}</h1>
              <p className="mt-1.5 max-w-xl text-sm text-slate-600">{current.blurb}</p>
            </div>
            {activeTab !== "users" && activeTab !== "events" && activeTab !== "market" && (
              <Btn onClick={refresh} disabled={busy}>
                <RefreshCw size={16} className={busy ? "animate-spin" : ""} /> Refresh
              </Btn>
            )}
          </div>

          {/* HOME */}
          {activeTab === "home" && (
            <>
              <section aria-label="Overview" className="mb-6 grid gap-4 sm:grid-cols-2">
                <button
                  onClick={() => setActiveTab("approvals")}
                  className={`group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#FF7900] hover:shadow-md ${focus}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-xl bg-orange-50 p-3 text-[#FF7900]"><ShieldCheck size={22} /></span>
                    <ArrowUpRight size={18} className="text-slate-400 transition group-hover:text-[#FF7900]" />
                  </div>
                  <p className="mt-4 text-sm text-slate-600">Pending organizer applications</p>
                  <p className="mt-1 text-4xl font-extrabold">{applicationsLoading ? "–" : applications.length}</p>
                  <p className="mt-3 text-sm font-bold text-[#B45309]">Review applications</p>
                </button>

                <button
                  onClick={() => setActiveTab("reps")}
                  className={`group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#FF7900] hover:shadow-md ${focus}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-xl bg-orange-50 p-3 text-[#FF7900]"><Megaphone size={22} /></span>
                    <ArrowUpRight size={18} className="text-slate-400 transition group-hover:text-[#FF7900]" />
                  </div>
                  <p className="mt-4 text-sm text-slate-600">Pending rep requests</p>
                  <p className="mt-1 text-4xl font-extrabold">{repsLoading ? "–" : repApplications.length}</p>
                  <p className="mt-3 text-sm font-bold text-[#B45309]">Review update posters</p>
                </button>

                <button
                  onClick={() => setActiveTab("feedback")}
                  className={`group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#FF7900] hover:shadow-md ${focus}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-xl bg-orange-50 p-3 text-[#FF7900]"><MessageSquare size={22} /></span>
                    <ArrowUpRight size={18} className="text-slate-400 transition group-hover:text-[#FF7900]" />
                  </div>
                  <p className="mt-4 text-sm text-slate-600">Unread feedback</p>
                  <p className="mt-1 text-4xl font-extrabold">{feedbackLoading ? "–" : feedbackNewCount}</p>
                  <p className="mt-3 text-sm font-bold text-[#B45309]">Read what students said</p>
                </button>

                <button
                  onClick={() => setActiveTab("market")}
                  className={`group rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition hover:border-[#FF7900] hover:shadow-md ${focus}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="rounded-xl bg-orange-50 p-3 text-[#FF7900]"><ShoppingBag size={22} /></span>
                    <ArrowUpRight size={18} className="text-slate-400 transition group-hover:text-[#FF7900]" />
                  </div>
                  <p className="mt-4 text-sm text-slate-600">Pending marketplace reports</p>
                  <p className="mt-1 text-4xl font-extrabold">{marketPending}</p>
                  <p className="mt-3 text-sm font-bold text-[#B45309]">Review listings and sellers</p>
                </button>
              </section>

              <section aria-labelledby="tools-heading">
                <h2 id="tools-heading" className="mb-3 text-lg font-extrabold">Admin tools</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {([
                    ["approvals", ShieldCheck, "Organizer approvals", "Approve or reject event organizers"],
                    ["reps", Megaphone, "Update posters", "Approve the reps who can post campus updates"],
                    ["feedback", MessageSquare, "Student feedback", "Bugs and ideas sent in from the app"],
                    ["posts", FileText, "Posts and moderation", "View likes, comments and delete posts"],
                    ["reports", Flag, "Reported posts", "Review posts students have flagged"],
                    ["market", ShoppingBag, "Marketplace reports", "Review reported listings and sellers"],
                    ["users", Users, "User management", "View, filter and remove student accounts"],
                    ["events", CalendarDays, "Event management", "View and filter campus events"],
                  ] as const).map(([id, Icon, label, hint]) => (
                    <button
                      key={id}
                      onClick={() => setActiveTab(id)}
                      className={`flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-slate-300 hover:bg-slate-50 ${focus}`}
                    >
                      <span className="rounded-xl bg-slate-100 p-2.5 text-[#0B1F3A]"><Icon size={20} /></span>
                      <span>
                        <span className="block font-bold">{label}</span>
                        <span className="block text-sm text-slate-600">{hint}</span>
                      </span>
                      <ChevronRight size={18} className="ml-auto text-slate-400" />
                    </button>
                  ))}
                </div>

                {/* A page of its own rather than a tab, and highlighted,
                    because it is the only screen here with money attached.
                    Buried among the moderation tools it would be forgotten,
                    and forgotten promotions are promotions nobody renews. */}
                <Link
                  href="/admin/services"
                  className={`mt-3 flex items-center gap-4 rounded-2xl border border-orange-200 bg-orange-50 p-4 text-left transition hover:border-[#FF7900] ${focus}`}
                >
                  <span className="rounded-xl bg-white p-2.5 text-[#FF7900]"><ShoppingBag size={20} /></span>
                  <span>
                    <span className="block font-bold">Service promotions</span>
                    <span className="block text-sm text-slate-600">
                      Feature listings and see which promotions expire soon
                    </span>
                  </span>
                  <ChevronRight size={18} className="ml-auto text-slate-400" />
                </Link>
              </section>
            </>
          )}

          {/* APPROVALS */}
          {activeTab === "approvals" &&
            (applicationsLoading ? (
              <Spinner label="Loading applications..." />
            ) : applications.length === 0 ? (
              <Empty icon={CheckCircle2} title="No pending applications" text="New organizer requests will appear here." />
            ) : (
              <ul className="space-y-4">
                {applications.map((application) => {
                  const applicant = application.user;
                  const name = applicant?.name ?? application.name ?? "Unknown user";
                  const email = applicant?.email ?? application.email ?? "No email provided";
                  const university = applicant?.university ?? application.university ?? "University not provided";
                  const updating = updatingId === application.id;

                  return (
                    <li key={application.id}>
                      <Card className="p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                          <div className="flex min-w-0 flex-1 items-start gap-3">
                            <Avatar name={name} />
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-bold">{name}</h2>
                                <Badge tone="orange">{application.status ?? "Pending"}</Badge>
                              </div>
                              <p className="mt-1 break-all text-sm text-slate-600">{email}</p>
                              <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                                <GraduationCap size={15} className="shrink-0" /> {university}
                              </p>
                              {application.created_at && (
                                <p className="mt-1 text-xs text-slate-500">Applied {formatDate(application.created_at)}</p>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-3 sm:shrink-0">
                            <Btn onClick={() => updateApplication(application.id, "reject")} disabled={updating} className="flex-1 sm:flex-none">
                              <X size={16} /> Reject
                            </Btn>
                            <Btn variant="primary" onClick={() => updateApplication(application.id, "approve")} disabled={updating} className="flex-1 sm:flex-none">
                              {updating ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                              {updating ? "Updating..." : "Approve"}
                            </Btn>
                          </div>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            ))}

          {/* REPS */}
          {activeTab === "reps" &&
            (repsLoading ? (
              <Spinner label="Loading rep requests..." />
            ) : repApplications.length === 0 ? (
              <Empty
                icon={Megaphone}
                title="No pending rep requests"
                text="Students asking to post campus updates will appear here."
              />
            ) : (
              <ul className="space-y-4">
                {repApplications.map((application) => {
                  const student = application.user;
                  const updating = repUpdatingId === application.id;
                  const scope = [
                    application.level ? `${application.level} Level` : null,
                    application.department,
                    application.faculty,
                  ].filter(Boolean).join(" · ");

                  return (
                    <li key={application.id}>
                      <Card className="p-5">
                        <div className="flex items-start gap-3">
                          <Avatar name={student?.name} />
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="text-lg font-bold">{student?.name ?? "Unknown student"}</h2>
                              <Badge tone="orange">
                                {REP_POSITIONS[application.position] ?? application.position}
                              </Badge>
                              {student?.is_verified && <Badge tone="green">School email verified</Badge>}
                            </div>
                            <p className="mt-1 break-all text-sm text-slate-600">
                              {student?.email ?? "No email provided"}
                            </p>
                            <p className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-slate-700">
                              <GraduationCap size={15} className="shrink-0" /> {scope}
                            </p>
                            {application.created_at && (
                              <p className="mt-1 text-xs text-slate-500">
                                Requested {formatDate(application.created_at)}
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-xs font-bold text-slate-500">How to verify</p>
                          <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">
                            {application.evidence}
                          </p>
                        </div>

                        <p className="mt-3 text-xs leading-5 text-slate-500">
                          Approving lets this student post updates to <strong>{scope}</strong> only.
                          They cannot mark anything urgent — that stays with admins.
                        </p>

                        <div className="mt-4 flex gap-3">
                          <Btn
                            onClick={() => updateRepApplication(application.id, "reject")}
                            disabled={updating}
                            className="flex-1 sm:flex-none"
                          >
                            <X size={16} /> Reject
                          </Btn>
                          <Btn
                            variant="primary"
                            onClick={() => updateRepApplication(application.id, "approve")}
                            disabled={updating}
                            className="flex-1 sm:flex-none"
                          >
                            {updating ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                            {updating ? "Updating..." : "Approve"}
                          </Btn>
                        </div>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            ))}

          {/* FEEDBACK */}
          {activeTab === "feedback" && (
            <>
              <div className="mb-4 flex flex-wrap gap-2">
                {([
                  ["all", `All (${feedback.length})`],
                  ["new", `New (${feedbackNewCount})`],
                  ["seen", "Seen"],
                  ["done", "Done"],
                ] as const).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setFeedbackFilter(id)}
                    aria-pressed={feedbackFilter === id}
                    className={`rounded-full border px-3.5 py-1.5 text-sm font-semibold transition ${focus} ${
                      feedbackFilter === id
                        ? "border-transparent bg-[#0B1F3A] text-white"
                        : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {feedbackLoading ? (
                <Spinner label="Loading feedback..." />
              ) : visibleFeedback.length === 0 ? (
                <Empty
                  icon={MessageSquare}
                  title={feedback.length === 0 ? "No feedback yet" : "Nothing in this filter"}
                  text={
                    feedback.length === 0
                      ? "Bugs and ideas students send from the app will appear here."
                      : "Try a different filter to see the rest."
                  }
                />
              ) : (
                <ul className="space-y-4">
                  {visibleFeedback.map((item) => {
                    const kind = FEEDBACK_TYPES[item.type] ?? FEEDBACK_TYPES.other;
                    const KindIcon = kind.icon;
                    const updating = feedbackUpdatingId === item.id;
                    const isNew = item.status === "new";
                    const tone = isNew ? "orange" : item.status === "done" ? "green" : "gray";

                    return (
                      <li key={item.id}>
                        <Card className={`border-l-4 p-5 ${isNew ? "border-l-[#FF7900]" : "border-l-slate-200"}`}>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-700">
                              <KindIcon size={13} /> {kind.label}
                            </span>
                            <Badge tone={tone}>
                              {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                            </Badge>
                            {item.page && (
                              <span className="rounded-full bg-slate-100 px-2.5 py-1 font-mono text-xs text-slate-600">
                                {item.page}
                              </span>
                            )}
                          </div>

                          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">
                            {item.message}
                          </p>

                          <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-slate-100 pt-3 text-xs text-slate-500">
                            <span className="font-semibold text-slate-700">
                              {item.user?.name ?? "Signed-out student"}
                            </span>
                            {item.user?.email && <span className="break-all">{item.user.email}</span>}
                            {item.created_at && <span>{formatDate(item.created_at)}</span>}
                          </div>

                          {/* Which phone and browser. Kept small and last —
                              you only need it when a bug won't reproduce. */}
                          {item.user_agent && (
                            <details className="mt-2">
                              <summary className="cursor-pointer text-xs font-semibold text-slate-500">
                                Device details
                              </summary>
                              <p className="mt-1 break-all font-mono text-[11px] leading-5 text-slate-500">
                                {item.user_agent}
                              </p>
                            </details>
                          )}

                          <div className="mt-4 flex flex-wrap gap-2">
                            {item.status !== "seen" && (
                              <Btn onClick={() => updateFeedbackStatus(item.id, "seen")} disabled={updating}>
                                {updating ? <LoaderCircle size={16} className="animate-spin" /> : null}
                                Mark seen
                              </Btn>
                            )}
                            {item.status !== "done" && (
                              <Btn variant="primary" onClick={() => updateFeedbackStatus(item.id, "done")} disabled={updating}>
                                <CheckCircle2 size={16} /> Mark done
                              </Btn>
                            )}
                            <Btn
                              variant="danger"
                              onClick={() => deleteFeedback(item)}
                              disabled={updating}
                              className="ml-auto"
                            >
                              <Trash2 size={16} /> Delete
                            </Btn>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}

          {/* POSTS */}
          {activeTab === "posts" && (
            <>
              {postsLoading ? (
                <Spinner label="Loading posts..." />
              ) : posts.length === 0 ? (
                <Empty icon={FileText} title="No posts found" text="Posts from the campus feed will appear here." />
              ) : (
                <>
                  <p className="mb-3 text-sm font-semibold text-slate-600">{posts.length} posts on this page</p>
                  <ul className="space-y-4">
                    {posts.map((post) => {
                      const imageUrl = getImageUrl(post.image_path);
                      const open = expandedPostId === post.id;
                      return (
                        <li key={post.id}>
                          <Card className="overflow-hidden">
                            <div className="p-5">
                              <div className="flex items-start gap-3">
                                <Avatar name={post.user?.name} />
                                <div className="min-w-0 flex-1">
                                  <h2 className="font-bold">{post.user?.name ?? "Unknown user"}</h2>
                                  <p className="text-sm text-slate-600">{post.user?.university ?? "University not provided"}</p>
                                  <p className="text-xs text-slate-500">{formatDate(post.created_at)}</p>
                                </div>
                                <Badge tone="gray">#{post.id}</Badge>
                              </div>

                              <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{post.content}</p>

                              {imageUrl && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={imageUrl} alt="Post attachment" className="mt-4 max-h-96 w-full rounded-xl border border-slate-100 bg-slate-50 object-contain" />
                              )}

                              <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
                                <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                                  <Heart size={16} /> {post.likes_count ?? 0}
                                  <span className="sr-only">likes</span>
                                </span>
                                <button
                                  onClick={() => toggleComments(post.id)}
                                  aria-expanded={open}
                                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition ${focus} ${
                                    open ? "bg-[#0B1F3A] text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                                  }`}
                                >
                                  <MessageCircle size={16} /> {post.comments_count ?? 0}
                                  <span className="sr-only">comments</span>
                                </button>
                                <Btn variant="danger" onClick={() => deletePost(post)} disabled={deletingId === post.id} className="ml-auto">
                                  {deletingId === post.id ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                  {deletingId === post.id ? "Deleting..." : "Delete"}
                                </Btn>
                              </div>
                            </div>

                            {open && (
                              <div className="border-t border-slate-200 bg-slate-50 p-5">
                                <h3 className="flex items-center gap-2 font-bold"><MessageCircle size={17} /> Comments</h3>
                                {commentsLoadingId === post.id ? (
                                  <p className="mt-3 flex items-center gap-2 text-sm text-slate-600">
                                    <LoaderCircle size={16} className="animate-spin" /> Loading comments...
                                  </p>
                                ) : (commentsByPost[post.id] ?? []).length === 0 ? (
                                  <p className="mt-3 text-sm text-slate-600">No comments found.</p>
                                ) : (
                                  <ul className="mt-3 space-y-3">
                                    {(commentsByPost[post.id] ?? []).map((comment) => (
                                      <li
                                        key={comment.id}
                                        className={`rounded-xl border border-slate-200 bg-white p-3 ${comment.parent_id ? "ml-6 border-l-4 border-l-orange-200" : ""}`}
                                      >
                                        <p className="text-sm font-bold">{comment.user?.name ?? "Unknown user"}</p>
                                        <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-700">{comment.content ?? ""}</p>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            )}
                          </Card>
                        </li>
                      );
                    })}
                  </ul>
                </>
              )}

              {postsLastPage > 1 && (
                <Card className="mt-6 flex items-center justify-between gap-4 p-4">
                  <Btn onClick={() => loadPosts(postsPage - 1)} disabled={postsPage <= 1 || postsLoading}>
                    <ChevronLeft size={17} /> Previous
                  </Btn>
                  <p className="text-sm text-slate-600">Page {postsPage} of {postsLastPage}</p>
                  <Btn onClick={() => loadPosts(postsPage + 1)} disabled={postsPage >= postsLastPage || postsLoading}>
                    Next <ChevronRight size={17} />
                  </Btn>
                </Card>
              )}
            </>
          )}

          {/* REPORTS */}
          {activeTab === "reports" &&
            (reportsLoading ? (
              <Spinner label="Loading reports..." />
            ) : reports.length === 0 ? (
              <Empty icon={Flag} title="No reports found" text="Reports submitted by students will appear here." />
            ) : (
              <>
                <p className="mb-3 text-sm font-semibold text-slate-600">{pendingReports} pending of {reports.length} reports</p>
                <ul className="space-y-4">
                  {reports.map((report) => {
                    const isPending = report.status === "pending";
                    const updating = reportStatusUpdatingId === report.id;
                    const tone = isPending ? "orange" : report.status === "reviewed" ? "green" : "gray";

                    return (
                      <li key={report.id}>
                        <Card className={`border-l-4 p-5 ${isPending ? "border-l-[#FF7900]" : "border-l-slate-200"}`}>
                          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="font-bold">{REASONS[report.reason] ?? report.reason}</h2>
                                <Badge tone={tone}>{report.status.charAt(0).toUpperCase() + report.status.slice(1)}</Badge>
                              </div>
                              <p className="mt-1 text-sm text-slate-600">
                                Report #{report.id} · by {report.user?.name ?? "Unknown student"}
                                {report.created_at ? ` · ${formatDate(report.created_at)}` : ""}
                              </p>

                              {report.details && (
                                <p className="mt-3 whitespace-pre-wrap break-words text-sm text-slate-700">{report.details}</p>
                              )}

                              <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                                <p className="text-xs font-bold text-slate-500">Reported post #{report.post_id}</p>
                                <div className="mt-2 flex items-center gap-2">
                                  <Avatar name={report.post?.user?.name} />
                                  <p className="text-sm font-bold">{report.post?.user?.name ?? "Unknown post author"}</p>
                                </div>
                                <p className="mt-2 whitespace-pre-wrap break-words text-sm text-slate-700">
                                  {report.post?.content ?? "Post content is unavailable."}
                                </p>
                              </div>
                            </div>

                            <div className="flex flex-wrap gap-2 sm:w-40 sm:shrink-0 sm:flex-col">
                              {isPending && (
                                <>
                                  <Btn variant="primary" onClick={() => updateReportStatus(report.id, "reviewed")} disabled={updating} className="flex-1 sm:flex-none">
                                    {updating ? <LoaderCircle size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                    Mark reviewed
                                  </Btn>
                                  <Btn onClick={() => updateReportStatus(report.id, "dismissed")} disabled={updating} className="flex-1 sm:flex-none">
                                    <X size={16} /> Dismiss
                                  </Btn>
                                </>
                              )}
                              <Btn
                                variant="danger"
                                onClick={() => deletePost({ id: report.post_id, content: report.post?.content ?? "", user: report.post?.user ?? null })}
                                disabled={deletingId === report.post_id}
                                className="flex-1 sm:flex-none"
                              >
                                {deletingId === report.post_id ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                {deletingId === report.post_id ? "Deleting..." : "Delete post"}
                              </Btn>
                            </div>
                          </div>
                        </Card>
                      </li>
                    );
                  })}
                </ul>
              </>
            ))}

          {/* MARKETPLACE REPORTS (kept mounted so the tab badge stays up to date) */}
          <div hidden={activeTab !== "market"}>
            <MarketplaceReportsPanel
              active={activeTab === "market"}
              onError={setError}
              onNotice={setNotice}
              onPendingChange={setMarketPending}
            />
          </div>

          {/* USERS */}
          {activeTab === "users" && (
            <>
              <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">Users Management</h2>
                    <p className="mt-1 text-sm text-slate-500">View, filter and remove registered Campus Plus accounts.</p>
                  </div>
                  <span className="rounded-lg bg-orange-50 px-3 py-2 text-sm font-semibold text-[#FF7900]">{filteredAdminUsers.length} shown</span>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search name or email..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF7900] focus:ring-2 focus:ring-orange-100" aria-label="Search users by name or email" />
                  <select value={userRoleFilter} onChange={(e) => setUserRoleFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF7900]" aria-label="Filter users by role"><option value="all">All roles</option>{Array.from(new Set(adminUsers.map((user) => (user.role ?? "student").toLowerCase()))).sort().map((role) => <option key={role} value={role}>{role.charAt(0).toUpperCase() + role.slice(1)}</option>)}</select>
                  <select value={userUniversityFilter} onChange={(e) => setUserUniversityFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF7900]" aria-label="Filter users by university"><option value="all">All universities</option>{userUniversities.map((university) => <option key={university[0]} value={university[1]}>{university[1]}</option>)}</select>
                  <button onClick={() => { setUserSearch(""); setUserRoleFilter("all"); setUserUniversityFilter("all"); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">Clear filters</button>
                </div>
                <p className="mt-3 text-xs text-slate-400">Filters apply to the users on the current server page.</p>
              </section>

              {usersLoading ? (
                <Spinner label="Loading users..." />
              ) : filteredAdminUsers.length === 0 ? (
                <Empty icon={Users} title="No matching users" text="Try changing or clearing your filters." />
              ) : (
                <div className="space-y-3">
                  {filteredAdminUsers.map((user) => {
                    const role = (user.role ?? "student").toLowerCase();
                    const isSelf = meId !== null && user.id === meId;
                    const isAdminAccount = role === "admin";
                    const deleting = deletingUserId === user.id;

                    return (
                      <article key={user.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm">
                        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                          <div className="flex min-w-0 items-start gap-3">
                            <Avatar name={user.name} />
                            <div className="min-w-0">
                              <h3 className="font-bold">{user.name ?? "Unknown user"}</h3>
                              <p className="mt-1 break-all text-sm text-slate-500">{user.email ?? "No email provided"}</p>
                              <p className="mt-1 text-sm text-slate-500">{user.university ?? "University not provided"}</p>
                              <p className="mt-2 text-xs text-slate-400">
                                Joined {user.created_at ? new Date(user.created_at).toLocaleDateString() : "Date unavailable"}
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col items-start gap-3 sm:shrink-0 sm:items-end">
                            <div className="flex flex-wrap gap-2">
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{role}</span>
                              <span className="rounded-full bg-orange-50 px-3 py-1 text-xs font-semibold text-[#FF7900]">{user.organized_events_count ?? 0} organized</span>
                              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{user.event_attendances_count ?? 0} attending</span>
                            </div>

                            {isSelf ? (
                              <span className="text-xs font-semibold text-slate-400">This is your account</span>
                            ) : isAdminAccount ? (
                              <span className="text-xs font-semibold text-slate-400">Admin accounts are protected</span>
                            ) : (
                              <Btn variant="danger" onClick={() => deleteUser(user)} disabled={deleting}>
                                {deleting ? <LoaderCircle size={16} className="animate-spin" /> : <Trash2 size={16} />}
                                {deleting ? "Deleting..." : "Delete user"}
                              </Btn>
                            )}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}

              {usersLastPage > 1 && (
                <Card className="mt-5 flex items-center justify-between p-4">
                  <span className="text-sm text-slate-500">Page {usersPage} of {usersLastPage}</span>
                  <div className="flex gap-2">
                    <button disabled={usersPage <= 1 || usersLoading} onClick={() => loadAdminUsers(usersPage - 1)} className="rounded-xl border border-slate-200 p-2 disabled:opacity-40" aria-label="Previous page"><ChevronLeft size={18} /></button>
                    <button disabled={usersPage >= usersLastPage || usersLoading} onClick={() => loadAdminUsers(usersPage + 1)} className="rounded-xl border border-slate-200 p-2 disabled:opacity-40" aria-label="Next page"><ChevronRight size={18} /></button>
                  </div>
                </Card>
              )}
            </>
          )}

          {/* EVENTS */}
          {activeTab === "events" && (
            <>
              <section className="mb-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="text-lg font-bold">Events Management</h2><p className="mt-1 text-sm text-slate-500">View and filter campus events, organizers, and attendance.</p></div><span className="rounded-lg bg-orange-50 px-3 py-2 text-sm font-semibold text-[#FF7900]">{filteredAdminEvents.length} shown</span></div>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                  <input value={eventSearch} onChange={(e) => setEventSearch(e.target.value)} placeholder="Search event title..." className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF7900] focus:ring-2 focus:ring-orange-100" aria-label="Search events by title" />
                  <select value={eventOrganizerFilter} onChange={(e) => setEventOrganizerFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF7900]" aria-label="Filter events by organizer"><option value="all">All organizers</option>{eventOrganizers.map(([key, name]) => <option key={key} value={name}>{name}</option>)}</select>
                  <select value={eventStatusFilter} onChange={(e) => setEventStatusFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF7900]" aria-label="Filter events by status"><option value="all">All statuses</option>{eventStatuses.map((status) => <option key={status} value={status}>{status.charAt(0).toUpperCase() + status.slice(1)}</option>)}</select>
                  <select value={eventCategoryFilter} onChange={(e) => setEventCategoryFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF7900]" aria-label="Filter events by category"><option value="all">All categories</option>{eventCategories.map(([key, category]) => <option key={key} value={category}>{category}</option>)}</select>
                  <select value={eventCampusFilter} onChange={(e) => setEventCampusFilter(e.target.value)} className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-[#FF7900]" aria-label="Filter events by campus"><option value="all">All campuses</option>{eventCampuses.map(([key, campus]) => <option key={key} value={campus}>{campus}</option>)}</select>
                  <button onClick={() => { setEventSearch(""); setEventOrganizerFilter("all"); setEventStatusFilter("all"); setEventCategoryFilter("all"); setEventCampusFilter("all"); }} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50">Clear filters</button>
                </div><p className="mt-3 text-xs text-slate-400">Filters apply to the events on the current server page.</p></section>
              {eventsLoading ? <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-8 text-slate-500"><LoaderCircle size={20} className="animate-spin" />Loading events...</div> : filteredAdminEvents.length === 0 ? <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center"><CalendarDays size={32} className="mx-auto text-slate-400"/><h2 className="mt-3 font-semibold">No matching events</h2><p className="mt-2 text-sm text-slate-500">Try changing or clearing your filters.</p></div> : <div className="space-y-3">{filteredAdminEvents.map(event => <article key={event.id} className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm"><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div><h3 className="font-bold">{event.title ?? event.name ?? `Event #${event.id}`}</h3><p className="mt-1 text-sm text-slate-500">{event.category ?? "Campus event"}{event.venue ? ` · ${event.venue}` : ""}{event.campus ? ` · ${event.campus}` : ""}</p><p className="mt-1 text-sm text-slate-500">Organizer: {event.organizer?.name ?? "Unknown organizer"}</p><p className="mt-2 text-xs text-slate-400">{event.starts_at ?? event.start_date ?? event.date ? new Date(event.starts_at ?? event.start_date ?? event.date!).toLocaleString() : "Date unavailable"}</p></div><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold">{event.status ?? "scheduled"}</span><span className="rounded-lg bg-orange-50 px-3 py-2 text-sm font-semibold text-[#FF7900]">{event.attendees_count ?? 0} attendees</span></div></div></article>)}</div>}
              {eventsLastPage > 1 && <div className="mt-5 flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4"><span className="text-sm text-slate-500">Page {eventsPage} of {eventsLastPage}</span><div className="flex gap-2"><button disabled={eventsPage <= 1 || eventsLoading} onClick={() => loadAdminEvents(eventsPage - 1)} className="rounded-xl border border-slate-200 p-2 disabled:opacity-40"><ChevronLeft size={18}/></button><button disabled={eventsPage >= eventsLastPage || eventsLoading} onClick={() => loadAdminEvents(eventsPage + 1)} className="rounded-xl border border-slate-200 p-2 disabled:opacity-40"><ChevronRight size={18}/></button></div></div>}
            </>
          )}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav
        aria-label="Admin sections"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-2 pt-2 pb-[max(8px,env(safe-area-inset-bottom))] lg:hidden"
      >
        <div className="mx-auto flex max-w-lg justify-around">
          {MOBILE_TABS.map((id) => <NavButton key={id} id={id} mobile />)}
          <Link href="/profile" className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-1 py-1 text-xs font-semibold text-slate-500 ${focus}`}>
            <span className="flex h-8 w-14 items-center justify-center"><UserRound size={20} strokeWidth={1.8} aria-hidden="true" /></span>
            Profile
          </Link>
        </div>
      </nav>
    </div>
  );
}