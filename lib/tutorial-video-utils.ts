const youtubeHosts = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "music.youtube.com",
  "youtube-nocookie.com",
  "www.youtube-nocookie.com",
]);

function safeHttpUrl(value: string) {
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export function getYouTubeThumbnailUrl(videoUrl: string) {
  const url = safeHttpUrl(videoUrl);
  if (!url) return null;

  let videoId: string | null = null;
  if (url.hostname === "youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else if (youtubeHosts.has(url.hostname)) {
    videoId = url.searchParams.get("v");
    if (!videoId) {
      videoId = url.pathname.match(/^\/(?:embed|shorts|live)\/([^/?]+)/)?.[1] ?? null;
    }
  }

  if (!videoId || !/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
}

export function getTutorialVideoThumbnailUrl(videoUrl: string, customThumbnailUrl?: string | null) {
  const customUrl = customThumbnailUrl?.trim();
  if (customUrl && safeHttpUrl(customUrl)) return customUrl;
  return getYouTubeThumbnailUrl(videoUrl);
}
