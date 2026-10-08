import { describe, expect, it } from "vitest";

import { getTutorialVideoThumbnailUrl, getYouTubeThumbnailUrl } from "./tutorial-video-utils";

describe("tutorial video thumbnails", () => {
  it("builds a thumbnail URL for standard YouTube links", () => {
    expect(getYouTubeThumbnailUrl("https://www.youtube.com/watch?v=abc123xyz_0"))
      .toBe("https://img.youtube.com/vi/abc123xyz_0/hqdefault.jpg");
  });

  it("supports short, embed, and shorts YouTube URLs", () => {
    expect(getYouTubeThumbnailUrl("https://youtu.be/abc123xyz_0?t=12"))
      .toBe("https://img.youtube.com/vi/abc123xyz_0/hqdefault.jpg");
    expect(getYouTubeThumbnailUrl("https://www.youtube.com/embed/abc123xyz_0"))
      .toBe("https://img.youtube.com/vi/abc123xyz_0/hqdefault.jpg");
    expect(getYouTubeThumbnailUrl("https://youtube.com/shorts/abc123xyz_0"))
      .toBe("https://img.youtube.com/vi/abc123xyz_0/hqdefault.jpg");
  });

  it("prefers a valid custom thumbnail and falls back to a YouTube thumbnail", () => {
    expect(getTutorialVideoThumbnailUrl(
      "https://youtu.be/abc123xyz_0",
      "https://cdn.example.test/custom.jpg",
    )).toBe("https://cdn.example.test/custom.jpg");
    expect(getTutorialVideoThumbnailUrl("https://youtu.be/abc123xyz_0", " "))
      .toBe("https://img.youtube.com/vi/abc123xyz_0/hqdefault.jpg");
  });

  it("does not invent a thumbnail for other video hosts or unsafe custom URLs", () => {
    expect(getTutorialVideoThumbnailUrl("https://cdn.example.test/tutorial.mp4"))
      .toBeNull();
    expect(getTutorialVideoThumbnailUrl("https://cdn.example.test/tutorial.mp4", "javascript:alert(1)"))
      .toBeNull();
  });
});
