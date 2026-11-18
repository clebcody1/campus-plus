"use client";

import { useEffect, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import { storageUrl } from "@/lib/api";

/**
 * The photos attached to a post.
 *
 * `lightbox` decides what a tap does. On the post detail page it opens the
 * photo full screen. In the feed it is off, so the tap falls through to the
 * card and opens the post.
 *
 * Every tile carries its own height — an aspect ratio in the grid layouts, a
 * capped height for a lone photo. The image fills whatever the tile gives it,
 * so a tile without a height would show nothing at all.
 */
export default function PostImages({
  paths,
  lightbox = true,
}: {
  paths: (string | null | undefined)[];
  lightbox?: boolean;
}) {
  const images = paths
    .map((p) => storageUrl(p))
    .filter((url): url is string => Boolean(url));

  const count = images.length;
  const [openAt, setOpenAt] = useState<number | null>(null);

  useEffect(() => {
    if (openAt === null) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenAt(null);
      if (event.key === "ArrowRight") setOpenAt((i) => (i === null ? i : (i + 1) % count));
      if (event.key === "ArrowLeft") setOpenAt((i) => (i === null ? i : (i - 1 + count) % count));
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [openAt, count]);

  if (count === 0) return null;

  function tile(index: number, shape: string, fit: "cover" | "contain") {
    const src = images[index];

    const picture = (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        loading="lazy"
        className={`h-full w-full ${fit === "cover" ? "object-cover" : "object-contain"}`}
      />
    );

    const shell = `relative block w-full overflow-hidden rounded-xl bg-slate-100 ${shape}`;

    // Feed: a plain div, so the click bubbles up to the post card.
    if (!lightbox) {
      return (
        <div key={`${src}-${index}`} className={shell}>
          {picture}
        </div>
      );
    }

    return (
      <button
        key={`${src}-${index}`}
        type="button"
        onClick={() => setOpenAt(index)}
        aria-label={`Open photo ${index + 1} of ${count}`}
        className={`${shell} cursor-zoom-in transition hover:opacity-95`}
      >
        {picture}
      </button>
    );
  }

  return (
    <>
      <div className="mb-4">
        {count === 1 && tile(0, "h-auto max-h-[480px] min-h-[160px]", "contain")}

        {count === 2 && (
          <div className="grid grid-cols-2 gap-1.5">
            {tile(0, "aspect-square", "cover")}
            {tile(1, "aspect-square", "cover")}
          </div>
        )}

        {count === 3 && (
          <div className="grid grid-cols-2 gap-1.5">
            <div className="col-span-2">{tile(0, "aspect-[2/1]", "cover")}</div>
            {tile(1, "aspect-square", "cover")}
            {tile(2, "aspect-square", "cover")}
          </div>
        )}

        {count >= 4 && (
          <div className="grid grid-cols-2 gap-1.5">
            {tile(0, "aspect-square", "cover")}
            {tile(1, "aspect-square", "cover")}
            {tile(2, "aspect-square", "cover")}
            <div className="relative">
              {tile(3, "aspect-square", "cover")}
              {count > 4 && (
                <span className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-slate-900/55 text-2xl font-extrabold text-white">
                  +{count - 4}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Full screen viewer — only ever reachable when lightbox is on. */}
      {lightbox && openAt !== null && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center bg-black/90 p-4"
          onClick={() => setOpenAt(null)}
        >
          <button
            type="button"
            aria-label="Close photo"
            onClick={() => setOpenAt(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <X size={22} />
          </button>

          {count > 1 && (
            <>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenAt((i) => (i === null ? i : (i - 1 + count) % count));
                }}
                className="absolute left-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <ChevronLeft size={24} />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={(event) => {
                  event.stopPropagation();
                  setOpenAt((i) => (i === null ? i : (i + 1) % count));
                }}
                className="absolute right-3 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
              >
                <ChevronRight size={24} />
              </button>
            </>
          )}

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={images[openAt]}
            alt=""
            onClick={(event) => event.stopPropagation()}
            className="max-h-[90vh] max-w-full rounded-lg object-contain"
          />

          {count > 1 && (
            <p className="absolute bottom-5 text-sm font-semibold text-white/80">
              {openAt + 1} / {count}
            </p>
          )}
        </div>
      )}
    </>
  );
}