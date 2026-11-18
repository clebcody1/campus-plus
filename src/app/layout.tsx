import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import AuthGuard from "@/components/AuthGuard";
import { Suspense } from "react";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

/*
 | Nothing here names a single school.
 |
 | This text is the first thing anyone sees: it is the card WhatsApp draws
 | when a link is shared. Saying "for LAUTECH students" to somebody at
 | another university tells them the app is not for them before they ever
 | open it.
 */
export const metadata: Metadata = {
  metadataBase: new URL("https://campusplus.com.ng"),
  title: "Campus Plus",
  description:
    "Posts, events, marketplace and student services for your campus.",
  applicationName: "Campus Plus",
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    siteName: "Campus Plus",
    title: "Campus Plus",
    description:
      "The app for Nigerian university students. Campus posts, events, a student marketplace and rated student businesses, all from your own school.",
    url: "https://campusplus.com.ng",
  },
  twitter: {
    card: "summary_large_image",
    title: "Campus Plus",
    description:
      "Posts, events, marketplace and student services for your campus.",
  },
  appleWebApp: {
    capable: true,
    title: "Campus Plus",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  themeColor: "#0B1F3A",
};

/*
 | Runs as the very first thing in the page, before the browser paints
 | anything and long before React loads. If there is no saved login it
 | redirects right away, so a logged-out visitor never sees a frame of a
 | protected page.
 |
 | This list MUST stay in step with PUBLIC_PATHS in AuthGuard. This script
 | wins, because it runs before React mounts: anything AuthGuard allows but
 | this does not is simply unreachable. That is what happened to
 | /forgot-password and /reset-password, which only ever get opened by
 | somebody who is logged out.
 |
 | The services directory and individual listings are open to people with
 | no account on purpose. A vendor sharing their listing on WhatsApp is how
 | most students will first hear of this app, and a link that bounces
 | straight to a login screen converts nobody.
 |
 | The services match is exact. "/services" and "/services/42" are public;
 | "/services/mine", "/services/new" and "/services/42/edit" are not, so a
 | prefix match would quietly open three pages that need an account to do
 | anything at all.
 */
const AUTH_REDIRECT = `
(function () {
  try {
    var path = location.pathname;

    var openPrefixes = [
      "/welcome",
      "/login",
      "/signup",
      "/forgot-password",
      "/reset-password"
    ];

    var isPublic =
      openPrefixes.some(function (p) {
        return path === p || path.indexOf(p + "/") === 0;
      }) ||
      path === "/services" ||
      /^\\/services\\/\\d+$/.test(path);

    if (!isPublic && !localStorage.getItem("campus_life_token")) {
      document.documentElement.style.visibility = "hidden";
      location.replace("/welcome");
    }
  } catch (e) {
    // Private browsing can block localStorage. Let AuthGuard handle it.
  }
})();
`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <script dangerouslySetInnerHTML={{ __html: AUTH_REDIRECT }} />
        <ServiceWorkerRegister />
        <Suspense fallback={null}>
          <AuthGuard>{children}</AuthGuard>
        </Suspense>
      </body>
    </html>
  );
}