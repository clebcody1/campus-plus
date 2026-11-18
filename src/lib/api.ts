// The one place the API address is defined.
//
// The value comes from NEXT_PUBLIC_API_URL, which Next.js reads from your
// .env files at BUILD time:
//
//   npm run dev    -> .env.development
//   npm run build  -> .env.production
//
// The fallback below is only used if neither file sets it.

export const API_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "https://api.campusplus.com.ng/api"
).replace(/\/+$/, "");

// The server root, without the trailing /api — used for images in storage.
export const API_ORIGIN = API_URL.replace(/\/api\/?$/, "");

// Turns a stored file path (e.g. "avatars/abc.jpg") into a full image address.
export function storageUrl(path?: string | null) {
  if (!path) return null;
  if (/^(https?:|data:)/i.test(path)) return path;
  return `${API_ORIGIN}/storage/${path.replace(/^\/+/, "")}`;
}