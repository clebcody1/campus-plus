"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <h1 className="text-3xl font-bold text-gray-900">Something went wrong</h1>
      <p className="mt-2 max-w-sm text-gray-600">
        We couldn&apos;t load this page. Try again in a moment.
      </p>
      <button
        onClick={reset}
        className="mt-6 rounded-full bg-orange-500 px-6 py-3 font-semibold text-white transition hover:bg-orange-600"
      >
        Try again
      </button>
    </main>
  );
}