// Pure URL parsing for NetnoKit. Never fetches anything.

const YOUTUBE_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be", "www.youtu.be"]);

export type ParsedYouTubeUrl = { platform: "youtube"; videoId: string };

export type ParsedInstagramUrl = { platform: "instagram"; shortcode: string; kind: "post" | "reel" | "tv" };

export type ParsedNetnoKitUrl = ParsedYouTubeUrl | ParsedInstagramUrl;

export function parseNetnoKitUrl(raw: string): ParsedNetnoKitUrl | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  const host = url.hostname.toLowerCase();
  if (YOUTUBE_HOSTS.has(host)) return parseYouTube(url);
  if (host === "instagram.com" || host === "www.instagram.com") return parseInstagram(url);
  return null;
}

function parseYouTube(url: URL): ParsedYouTubeUrl | null {
  const host = url.hostname.toLowerCase();
  let videoId: string | null = null;
  if (host === "youtu.be" || host === "www.youtu.be") {
    videoId = url.pathname.split("/").filter(Boolean)[0] ?? null;
  } else {
    if (url.pathname === "/watch") {
      videoId = url.searchParams.get("v");
    } else {
      const parts = url.pathname.split("/").filter(Boolean);
      // /shorts/<id>, /live/<id>, /embed/<id>
      if (parts.length >= 2 && ["shorts", "live", "embed", "v"].includes(parts[0])) {
        videoId = parts[1];
      }
    }
  }
  if (!videoId || !/^[A-Za-z0-9_-]{6,20}$/.test(videoId)) return null;
  return { platform: "youtube", videoId };
}

function parseInstagram(url: URL): ParsedInstagramUrl | null {
  const parts = url.pathname.split("/").filter(Boolean);
  // /p/<shortcode>, /reel/<shortcode>, /reels/<shortcode>, /tv/<shortcode>
  if (parts.length < 2) return null;
  const kindToken = parts[0].toLowerCase();
  let kind: ParsedInstagramUrl["kind"] | null = null;
  if (kindToken === "p") kind = "post";
  else if (kindToken === "reel" || kindToken === "reels") kind = "reel";
  else if (kindToken === "tv") kind = "tv";
  if (!kind) return null;
  const shortcode = parts[1];
  if (!/^[A-Za-z0-9_-]{5,20}$/.test(shortcode)) return null;
  return { platform: "instagram", shortcode, kind };
}
