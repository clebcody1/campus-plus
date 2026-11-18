"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, LoaderCircle, X } from "lucide-react";
import { API_URL, storageUrl } from "@/lib/api";

export const SERVICE_CATEGORIES: { id: string; label: string }[] = [
  { id: "food", label: "Food" },
  { id: "barber", label: "Barber" },
  { id: "hair", label: "Hair stylist" },
  { id: "laundry", label: "Laundry" },
  { id: "tailor", label: "Tailor" },
  { id: "printing", label: "Printing" },
  { id: "repairs", label: "Repairs" },
  { id: "photography", label: "Photography" },
  { id: "delivery", label: "Delivery" },
  { id: "tutoring", label: "Tutoring" },
  { id: "tech", label: "Tech" },
  { id: "other", label: "Other" },
];

export type ServiceDraft = {
  id?: number;
  name?: string;
  category?: string;
  description?: string | null;
  phone?: string;
  whatsapp?: string | null;
  location?: string | null;
  price_from?: string | number | null;
  image_path?: string | null;
  is_active?: boolean;
};

const inputClass =
  "w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[#0B1F3A] placeholder:text-slate-400 outline-none focus:border-[#FF7900] focus:ring-2 focus:ring-orange-100";

const labelClass = "mb-2 block text-sm font-semibold text-[#0B1F3A]";

/**
 * Create or edit a service listing.
 *
 * `existing` switches the form into edit mode. The request then goes out as
 * POST with _method=PATCH, because PHP does not populate uploaded files on a
 * real PATCH request.
 */
export default function ServiceForm({ existing }: { existing?: ServiceDraft }) {
  const router = useRouter();
  const editing = Boolean(existing?.id);

  const [name, setName] = useState(existing?.name ?? "");
  const [category, setCategory] = useState(existing?.category ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [phone, setPhone] = useState(existing?.phone ?? "");
  const [whatsapp, setWhatsapp] = useState(existing?.whatsapp ?? "");
  const [location, setLocation] = useState(existing?.location ?? "");
  const [priceFrom, setPriceFrom] = useState(
    existing?.price_from ? String(Number(existing.price_from)) : ""
  );
  const [isActive, setIsActive] = useState(existing?.is_active ?? true);

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(
    storageUrl(existing?.image_path) ?? null
  );
  const fileRef = useRef<HTMLInputElement>(null);

  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function pickImage(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // 8MB is the server's upload_max_filesize. Catching it here gives a
    // clear message instead of an empty request body.
    if (file.size > 8 * 1024 * 1024) {
      setError("That photo is larger than 8MB. Please choose a smaller one.");
      return;
    }

    setError("");
    setImageFile(file);
    setPreview(URL.createObjectURL(file));
  }

  function clearImage() {
    setImageFile(null);
    setPreview(storageUrl(existing?.image_path) ?? null);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    if (!category) {
      setError("Please choose a category.");
      return;
    }

    setSaving(true);

    const token = localStorage.getItem("campus_life_token");
    if (!token) {
      setError("Please log in again.");
      setSaving(false);
      return;
    }

    const form = new FormData();
    form.append("name", name.trim());
    form.append("category", category);
    form.append("description", description?.trim() ?? "");
    form.append("phone", phone.trim());
    if (whatsapp?.trim()) form.append("whatsapp", whatsapp.trim());
    if (location?.trim()) form.append("location", location.trim());
    if (priceFrom.trim()) form.append("price_from", priceFrom.trim());
    form.append("is_active", isActive ? "1" : "0");
    if (imageFile) form.append("image", imageFile);

    // Method spoofing: a real PATCH arrives with an empty $_FILES in PHP.
    if (editing) form.append("_method", "PATCH");

    const url = editing ? `${API_URL}/services/${existing!.id}` : `${API_URL}/services`;

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Accept: "application/json", Authorization: `Bearer ${token}` },
        body: form,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errors = data.errors as Record<string, string[]> | undefined;
        throw new Error(
          errors
            ? Object.values(errors).flat().join(" ")
            : data.message || "Could not save your service."
        );
      }

      router.push(`/services/${data.service?.id ?? existing?.id ?? ""}`);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof TypeError
          ? "Couldn't reach the server. Please check your connection and try again."
          : err instanceof Error
            ? err.message
            : "Something went wrong."
      );
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {/* Photo */}
      <div>
        <span className={labelClass}>Photo</span>
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 text-slate-400 transition hover:border-[#FF7900] hover:text-[#FF7900]"
          >
            {preview ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="" className="h-full w-full object-cover" />
            ) : (
              <ImagePlus size={26} />
            )}
          </button>

          <div className="flex-1 text-sm text-slate-600">
            <p className="leading-6">
              A clear photo of your work or your shop. Students scroll past listings
              with no picture.
            </p>
            {imageFile && (
              <button
                type="button"
                onClick={clearImage}
                className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-red-600 hover:underline"
              >
                <X size={14} /> Remove
              </button>
            )}
          </div>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          onChange={pickImage}
          className="hidden"
        />
      </div>

      <div>
        <label htmlFor="name" className={labelClass}>
          Business name
        </label>
        <input
          id="name"
          required
          maxLength={120}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Sunday's Barbing Salon"
          className={inputClass}
        />
      </div>

      <div>
        <span className={labelClass}>Category</span>
        <div className="flex flex-wrap gap-2">
          {SERVICE_CATEGORIES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setCategory(option.id)}
              aria-pressed={category === option.id}
              className={`rounded-full border px-3.5 py-2 text-sm font-semibold transition ${
                category === option.id
                  ? "border-transparent bg-[#0B1F3A] text-white"
                  : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="description" className={labelClass}>
          What do you do?
        </label>
        <textarea
          id="description"
          rows={4}
          maxLength={1500}
          value={description ?? ""}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What you offer, your working hours, anything students should know."
          className={`${inputClass} resize-none`}
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="phone" className={labelClass}>
            Phone number
          </label>
          <input
            id="phone"
            required
            inputMode="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="08012345678"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="whatsapp" className={labelClass}>
            WhatsApp <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <input
            id="whatsapp"
            inputMode="tel"
            value={whatsapp ?? ""}
            onChange={(e) => setWhatsapp(e.target.value)}
            placeholder="Leave blank if it's the same"
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <label htmlFor="location" className={labelClass}>
            Where are you?
          </label>
          <input
            id="location"
            maxLength={160}
            value={location ?? ""}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="e.g. Behind Queen Hostel, Gate"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="priceFrom" className={labelClass}>
            Price from <span className="font-normal text-slate-400">(optional)</span>
          </label>
          <div className="relative">
            <span className="pointer-events-none absolute inset-y-0 left-4 flex items-center font-semibold text-slate-400">
              ₦
            </span>
            <input
              id="priceFrom"
              inputMode="numeric"
              value={priceFrom}
              onChange={(e) => setPriceFrom(e.target.value.replace(/[^\d.]/g, ""))}
              placeholder="500"
              className={`${inputClass} pl-9`}
            />
          </div>
        </div>
      </div>

      {editing && (
        <label className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <input
            type="checkbox"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="mt-0.5 h-4 w-4 accent-[#FF7900]"
          />
          <span className="text-sm">
            <span className="font-semibold text-[#0B1F3A]">Listed and visible</span>
            <span className="block text-slate-600">
              Turn this off when you travel or stop taking customers. Your ratings are
              kept, and nobody sees the listing until you turn it back on.
            </span>
          </span>
        </label>
      )}

      {error && (
        <p role="alert" className="text-sm font-medium text-red-600">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF7900] px-5 py-3.5 font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {saving && <LoaderCircle size={18} className="animate-spin" />}
        {saving ? "Saving..." : editing ? "Save changes" : "List my business"}
      </button>
    </form>
  );
}