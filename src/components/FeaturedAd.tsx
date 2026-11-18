"use client";

import Link from "next/link";
import { Store, Star, MapPin, ArrowRight } from "lucide-react";
import { storageUrl } from "@/lib/api";
import { SERVICE_CATEGORIES } from "@/components/ServiceForm";
import type { FeaturedService } from "@/components/FeaturedServices";

const categoryLabel = (id: string) =>
  SERVICE_CATEGORIES.find((c) => c.id === id)?.label ?? id;

function naira(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return "₦" + n.toLocaleString("en-NG", { maximumFractionDigits: 0 });
}

/**
 * One promoted business, dropped into the feed between posts.
 *
 * `slot` is which gap in the feed this is, counting from zero. Cycling the
 * list by slot rather than picking at random means a reader scrolling past
 * four gaps sees four different businesses instead of the same one twice.
 */
export default function FeaturedAd({
  services,
  slot,
}: {
  services: FeaturedService[];
  slot: number;
}) {
  if (services.length === 0) return null;

  const service = services[slot % services.length];
  const image = storageUrl(service.image_path);
  const price = naira(service.price_from);

  return (
    <Link
      href={`/services/${service.id}`}
      className="block rounded-2xl border border-orange-200 bg-white p-4 transition hover:border-[#FF7900] hover:shadow-md"
    >
      {/* Labelled, always. A paid placement that looks like a normal post is
          how an app loses the trust that makes its ratings worth anything. */}
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-400">
        Promoted · Student service
      </p>

      <div className="flex items-center gap-3">
        <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-slate-100">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={image} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-slate-300">
              <Store size={22} />
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-bold text-[#0B1F3A]">{service.name}</p>
          <p className="truncate text-xs text-slate-500">
            {categoryLabel(service.category)}
          </p>

          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
            {service.rating.count > 0 ? (
              <span className="flex items-center gap-1 text-slate-600">
                <Star size={12} className="fill-[#FF7900] text-[#FF7900]" />
                <span className="font-bold text-[#0B1F3A]">
                  {service.rating.average.toFixed(1)}
                </span>
                <span>({service.rating.count})</span>
              </span>
            ) : (
              <span className="text-slate-400">New</span>
            )}

            {service.location && (
              <span className="flex min-w-0 items-center gap-1 text-slate-500">
                <MapPin size={11} className="shrink-0" />
                <span className="truncate">{service.location}</span>
              </span>
            )}

            {price && <span className="font-bold text-[#B45309]">from {price}</span>}
          </div>
        </div>

        <ArrowRight size={18} className="shrink-0 text-slate-400" aria-hidden="true" />
      </div>
    </Link>
  );
}