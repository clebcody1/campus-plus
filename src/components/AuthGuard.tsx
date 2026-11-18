"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

/*
 | Pages anyone can open without logging in.
 |
 | Keep this in step with AUTH_REDIRECT in app/layout.tsx. That inline
 | script runs before React mounts and wins, so anything allowed here but
 | missing there is simply unreachable.
 */
const PUBLIC_PATHS = ["/welcome", "/login", "/signup", "/forgot-password", "/reset-password"];

/*
 | The services directory and individual listings, open on purpose: a
 | vendor sharing their listing on WhatsApp is how most students first hear
 | of this app, and a link that bounces to a login screen converts nobody.
 |
 | Matched by pattern rather than prefix. "/services" and "/services/42"
 | are public; "/services/mine", "/services/new" and "/services/42/edit"
 | are not, and a startsWith check would quietly open all three.
 */
const PUBLIC_SERVICE_PATH = /^\/services(\/\d+)?$/;

function isPublicPath(pathname: string) {
  return (
    PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`)) ||
    PUBLIC_SERVICE_PATH.test(pathname)
  );
}

// useLayoutEffect runs before the browser paints, so the redirect happens
// without the protected page ever appearing on screen. It isn't available
// during server rendering, so fall back to useEffect there.
const useIsomorphicLayoutEffect =
  typeof window !== "undefined" ? useLayoutEffect : useEffect;

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  // "checking" until we know whether this person is allowed to see the page.
  const [status, setStatus] = useState<"checking" | "allowed">("checking");

  useIsomorphicLayoutEffect(() => {
    const isPublic = isPublicPath(pathname);

    let token: string | null = null;
    try {
      token = window.localStorage.getItem("campus_life_token");
    } catch {
      // Private browsing can block localStorage. Treat it as logged out.
    }

    if (!token && !isPublic) {
      // Stay on "checking" so nothing is painted before the redirect lands.
      setStatus("checking");
      router.replace("/welcome");
      return;
    }

    setStatus("allowed");
  }, [pathname, router]);

  const allowed = status === "allowed";

  // The page is always rendered, so Next.js can validate the route segment.
  // Until the check passes it is display:none, which paints nothing at all —
  // so there is still no flash of the feed before the redirect.
  return (
    <>
      {!allowed && <Splash />}
      <div style={allowed ? { display: "contents" } : { display: "none" }}>
        {children}
      </div>
    </>
  );
}

// A neutral brand screen shown for the instant before we know where to send
// the person. Looks deliberate rather than broken.
function Splash() {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-screen items-center justify-center bg-[#F0F4F9]"
    >
      <div className="flex items-center gap-3 opacity-90">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#0B1F3A] text-xl font-bold text-white">
          C
        </span>
        <span className="text-xl font-extrabold text-[#0B1F3A]">
          Campus <span className="text-[#FF7900]">Plus</span>
        </span>
      </div>
    </div>
  );
}