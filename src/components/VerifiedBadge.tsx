"use client";

import { useId } from "react";

type VerifiedBadgeProps = {
  className?: string;
  // Only admins get a tick for now. Pass `admin` for an admin; for anyone else
  // the badge renders nothing, on every page.
  admin?: boolean;
};

export default function VerifiedBadge({ className = "h-5 w-5", admin = false }: VerifiedBadgeProps) {
  // A unique gradient id per badge, so several badges on one page never clash.
  const gradientId = `verified-${useId().replace(/:/g, "")}`;

  // For now only admins are shown as verified. To bring student ticks back later,
  // delete this one line (and give students their own colours below).
  if (!admin) return null;

  // Site navy seal with a site orange check mark, and a very gentle gradient.
  const [light, base, dark] = ["#15294A", "#0B1F3A", "#081A31"];
  const rim = "#06142A";
  const tick = "#FF7900";

  // Two rounded squares, one turned 45 degrees, make the scalloped seal shape.
  const seal = (
    <>
      <rect x="3.3" y="3.3" width="17.4" height="17.4" rx="5.4" />
      <rect x="3.3" y="3.3" width="17.4" height="17.4" rx="5.4" transform="rotate(45 12 12)" />
    </>
  );

  return (
    <svg
      viewBox="0 0 24 24"
      className={`inline-block shrink-0 ${className}`}
      role="img"
      aria-label="Campus Life admin"
    >
      <title>Campus Life admin</title>
      <defs>
        <linearGradient id={gradientId} x1="12" y1="2" x2="12" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor={light} />
          <stop offset="0.5" stopColor={base} />
          <stop offset="1" stopColor={dark} />
        </linearGradient>
      </defs>

      {/* Thin rim: the same shape, slightly outlined, drawn underneath. */}
      <g fill={rim} stroke={rim} strokeWidth="0.8" strokeLinejoin="round">
        {seal}
      </g>

      {/* Face with the soft gradient. */}
      <g fill={`url(#${gradientId})`}>{seal}</g>

      {/* The check mark. */}
      <path
        d="M7.5 12.5l3 3.1 6.1-6.7"
        fill="none"
        stroke={tick}
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
