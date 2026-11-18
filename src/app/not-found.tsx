import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <p className="text-sm font-semibold tracking-widest text-orange-500">404</p>
      <h1 className="mt-3 text-3xl font-bold text-gray-900">Page not found</h1>
      <p className="mt-2 max-w-sm text-gray-600">
        That page doesn&apos;t exist, or it may have been removed.
      </p>
      <Link
        href="/"
        className="mt-6 rounded-full bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-600"
      >
        Back to campus feed
      </Link>
    </main>
  );
}