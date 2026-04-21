"use client";

import { useMemo, useState } from "react";

type RestaurantAvatarProps = {
  name: string;
  src?: string | null;
  size?: number;
  className?: string;
};

function isLikelyImageUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }
  // Allow absolute URLs and app-relative paths.
  return (
    trimmed.startsWith("http://") ||
    trimmed.startsWith("https://") ||
    trimmed.startsWith("/")
  );
}

export default function RestaurantAvatar({
  name,
  src,
  size = 40,
  className = "",
}: RestaurantAvatarProps) {
  const [failed, setFailed] = useState(false);

  const displaySrc = useMemo(() => {
    if (!src) {
      return null;
    }
    return isLikelyImageUrl(src) ? src : null;
  }, [src]);

  const fallbackLetter = (name || "R").trim().charAt(0).toUpperCase() || "R";

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 text-white shadow-sm ${className}`}
      style={{ width: size, height: size }}
      aria-label={`${name} logo`}
      title={name}
    >
      {/* Fallback letter always exists so the layout doesn't jump. */}
      <div className="absolute inset-0 flex items-center justify-center font-bold">
        <span style={{ fontSize: Math.max(12, Math.round(size * 0.42)) }}>
          {fallbackLetter}
        </span>
      </div>

      {!failed && displaySrc ? (
        // Use <img> to avoid Next/Image remote domain configuration issues.
        // If the backend returns a broken URL, we fall back to the letter.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={displaySrc}
          alt={`${name} logo`}
          className="absolute inset-0 h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : null}
    </div>
  );
}

