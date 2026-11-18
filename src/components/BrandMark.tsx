/**
 * The Campus Plus mark: an orange C with a graduation cap in its mouth.
 * Same artwork as the app icon, drawn as SVG so it stays sharp at any size.
 *
 *   <BrandMark size={40} />              navy tile, for light backgrounds
 *   <BrandMark size={40} background={false} />   art only, for navy surfaces
 */
export default function BrandMark({
  size = 40,
  background = true,
  className,
}: {
  size?: number;
  background?: boolean;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 512 512"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Campus Plus"
    >
      {background && <rect width="512" height="512" rx="112" fill="#0B1F3A" />}

      {/* The C: a thick arc with its mouth open to the right */}
      <path
        d="M409.9 152.2 A185.6 185.6 0 1 0 409.9 359.8"
        fill="none"
        stroke="#FF7900"
        strokeWidth="64"
      />

      {/* Cap body, then the mortarboard over it */}
      <path d="M198.7 243.2 A57.3 65.5 0 0 0 313.3 243.2 Z" fill="#fff" />
      <path d="M256 187.9 L361 238.1 L256 288.3 L151 238.1 Z" fill="#fff" />

      {/* Button and tassel */}
      <path
        d="M256 238.1 L323.2 252.4 L323.2 298.5"
        fill="none"
        stroke="#FF7900"
        strokeWidth="9.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="256" cy="238.1" r="8.7" fill="#FF7900" />
      <rect x="309.9" y="294.4" width="26.6" height="31.7" rx="13.3" fill="#FF7900" />
    </svg>
  );
}