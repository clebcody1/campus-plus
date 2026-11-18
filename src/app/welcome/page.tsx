import Link from "next/link";
import WelcomeScreen from "@/components/WelcomeScreen";
import BrandMark from "@/components/BrandMark";
import {
  ArrowRight,
  CalendarDays,
  Check,
  Heart,
  MessageCircle,
  ShoppingBag,
  Users,
} from "lucide-react";

export default function WelcomePage() {
  return (
    <main className="min-h-screen overflow-hidden bg-white text-[#0B1F3A]">
      <WelcomeScreen />
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/welcome" className="flex items-center gap-2">
          <BrandMark size={40} className="shrink-0 rounded-xl" />
          <span className="text-xl font-extrabold tracking-tight">
            Campus <span className="text-[#FF7900]">Plus</span>
          </span>
        </Link>

        {/* The only place returning students need. Kept as a quiet text link
            so it never competes with Get Started. */}
        <Link
          href="/login"
          className="rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-[#F0F4F9] hover:text-[#0B1F3A]"
        >
          Log in
        </Link>
      </header>

      <section className="mx-auto grid max-w-7xl items-center gap-12 px-5 pb-16 pt-12 sm:px-8 md:grid-cols-2 md:py-24">
        <div>
          <span className="inline-flex rounded-full bg-[#FFF3E8] px-4 py-2 text-sm font-semibold text-[#0B1F3A]">
            Your campus community starts here
          </span>

          <h1 className="mt-6 max-w-xl text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Campus life is better{" "}
            <span className="text-[#FF7900]">together.</span>
          </h1>

          <p className="mt-6 max-w-lg text-base leading-7 text-slate-600 sm:text-lg">
            Meet students, discover campus events, buy and sell essentials,
            and connect with people across Nigerian universities.
          </p>

          {/* One action, and it is unmistakable. Two buttons of similar
              weight side by side made neither of them read as the thing to
              do — so signing in is now a plain text link underneath, and the
              header keeps a second copy for people who look up there. */}
          <div className="mt-8 max-w-sm">
            <Link
              href="/signup"
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF7900] px-7 py-4 text-lg font-extrabold text-[#0B1F3A] shadow-lg shadow-orange-500/30 transition hover:-translate-y-0.5 hover:bg-[#FF8F26] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0B1F3A]"
            >
              Get Started
              <ArrowRight size={20} strokeWidth={2.5} aria-hidden="true" />
            </Link>

            <p className="mt-3 text-center text-sm text-slate-500">
              Free for students · takes about 30 seconds
            </p>

            <p className="mt-4 text-center text-sm text-slate-500">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-[#B45309] underline-offset-4 hover:underline"
              >
                Log in
              </Link>
            </p>
          </div>

          <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-500">
            {["Student community", "Campus events", "Student marketplace"].map(
              (item) => (
                <span key={item} className="inline-flex items-center gap-1.5">
                  <Check
                    size={16}
                    strokeWidth={2.5}
                    aria-hidden="true"
                    className="shrink-0 text-[#FF7900]"
                  />
                  {item}
                </span>
              )
            )}
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-lg">
          <div className="absolute inset-8 rounded-full bg-[#FFF3E8] blur-3xl" />

          <div className="relative rounded-3xl border border-[#F0F4F9] bg-white p-5 shadow-2xl shadow-slate-200/70 sm:p-7">
            <div className="flex items-center justify-between border-b border-[#F0F4F9] pb-5">
              <div>
                <p className="text-sm text-slate-500">Your community</p>
                <h2 className="mt-1 text-xl font-extrabold">Campus Feed</h2>
              </div>
              <span className="rounded-full bg-[#F0F4F9] px-3 py-1 text-xs font-bold text-[#0B1F3A]">
                Preview
              </span>
            </div>

            <div className="mt-5 rounded-2xl bg-[#F0F4F9] p-4">
              <div className="flex items-center gap-3">
                <BrandMark size={44} className="shrink-0 rounded-full" />
                <div>
                  <p className="font-bold">Campus Plus</p>
                  <p className="text-xs text-slate-500">
                    Ladoke Akintola University of Technology · 12 min ago
                  </p>
                </div>
              </div>
              <p className="mt-4 leading-6 text-slate-700">
                Anyone around campus this afternoon? Let&apos;s find somewhere
                nice to eat and catch up!
              </p>
              <div className="mt-4 flex gap-5 text-sm text-slate-500">
                <span className="inline-flex items-center gap-1.5">
                  <Heart size={16} strokeWidth={1.8} aria-hidden="true" />
                  24 likes
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MessageCircle size={16} strokeWidth={1.8} aria-hidden="true" />
                  8 comments
                </span>
              </div>
            </div>

            <div className="mt-4 rounded-2xl border border-[#FFF3E8] bg-[#FFF3E8] p-4">
              <p className="text-sm font-bold text-[#0B1F3A]">
                Discover more on Campus Plus
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs font-semibold text-slate-700">
                {[
                  { Icon: CalendarDays, label: "Events" },
                  { Icon: ShoppingBag, label: "Marketplace" },
                  { Icon: Users, label: "Community" },
                ].map(({ Icon, label }) => (
                  <div
                    key={label}
                    className="flex flex-col items-center gap-2 rounded-xl bg-white p-3"
                  >
                    <Icon
                      size={24}
                      strokeWidth={1.8}
                      aria-hidden="true"
                      className="text-[#FF7900]"
                    />
                    {label}
                  </div>
                ))}
              </div>
            </div>

            <p className="mt-5 text-center text-xs text-slate-400">
              A preview of what your campus community can become.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-[#F0F4F9] px-5 py-6 text-center text-sm text-slate-500">
        Campus Plus · Built for students, across campuses.
      </footer>
    </main>
  );
}