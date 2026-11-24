export const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

export function formatDateTime(value: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-PH", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatDate(value: string | null | undefined) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

export const MODE_LABEL: Record<string, string> = { zoom: "Zoom (online)", face_to_face: "Face-to-face" };

export const FORMAT_LABEL: Record<string, string> = {
  self_paced: "Self-paced (recorded)",
  guided: "Guided workshop",
};

/**
 * Turns a lesson video link into something we can embed.
 * Supports YouTube, Vimeo, Loom, Google Drive, Bunny Stream and direct video files.
 */
export function toEmbed(url: string): { kind: "iframe" | "video"; src: string } | null {
  if (!url) return null;
  try {
    const u = new URL(url, window.location.origin);
    if (!/^https?:$/.test(u.protocol)) return null;
    const host = u.hostname.replace(/^www\./, "");
    if (/\.(mp4|webm|m3u8)$/i.test(u.pathname)) return { kind: "video", src: u.href };
    if (host === "youtu.be") return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}` };
    if (host.endsWith("youtube.com")) {
      const id = u.searchParams.get("v") ?? u.pathname.split("/").filter(Boolean).pop();
      return { kind: "iframe", src: `https://www.youtube-nocookie.com/embed/${id}?rel=0` };
    }
    if (host === "vimeo.com") return { kind: "iframe", src: `https://player.vimeo.com/video/${u.pathname.split("/")[1]}` };
    if (host === "loom.com") return { kind: "iframe", src: u.href.replace("/share/", "/embed/") };
    if (host === "drive.google.com") return { kind: "iframe", src: u.href.replace(/\/view.*$/, "/preview") };
    return { kind: "iframe", src: u.href };
  } catch {
    return null;
  }
}
