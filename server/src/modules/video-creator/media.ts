// Image/video processing for the AI Video Creator, done with ffmpeg/ffprobe
// (required on the server — see README "AI Video Creator > Deployment").
// Every function works on Buffers via a private temp directory that is always
// removed afterwards, and never shells out through a shell (execFile only),
// so customer-entered text can't inject commands.

import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH || "ffmpeg";
const FFPROBE = process.env.FFPROBE_PATH || "ffprobe";

const here = dirname(fileURLToPath(import.meta.url));
// src/modules/video-creator -> server/assets (also correct from dist/modules/video-creator)
const FONT_DIR = resolve(here, "../../../assets/fonts");
const FONT_BOLD = join(FONT_DIR, "Inter-Bold.otf");
const FONT_EXTRABOLD = join(FONT_DIR, "Inter-ExtraBold.otf");

async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "maia-vc-"));
  try {
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

/** Identifies the real file type from its first bytes — never trusts the browser's claimed MIME type or extension. */
export function sniffImageType(buf: Buffer): ImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.length >= 12 && buf.subarray(0, 4).toString("ascii") === "RIFF" && buf.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  return null;
}

interface ProbeStream {
  codec_type?: string;
  codec_name?: string;
  width?: number;
  height?: number;
}

async function probe(path: string): Promise<{ streams: ProbeStream[]; format?: { duration?: string; format_name?: string } }> {
  const { stdout } = await run(FFPROBE, ["-v", "error", "-show_streams", "-show_format", "-of", "json", path], { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 });
  return JSON.parse(stdout);
}

/**
 * Validates and re-encodes an uploaded product photo as a clean JPEG
 * (max 2048px on the long side). Re-encoding strips EXIF/GPS metadata and
 * guarantees Google receives a format it accepts.
 */
export async function normalizeProductPhoto(input: Buffer): Promise<{ buffer: Buffer; width: number; height: number }> {
  return withTempDir(async (dir) => {
    const src = join(dir, "in");
    const out = join(dir, "out.jpg");
    await writeFile(src, input);
    const info = await probe(src).catch(() => null);
    const stream = info?.streams.find((s) => s.codec_type === "video");
    if (!stream?.width || !stream?.height) throw new Error("This file could not be read as an image.");
    if (stream.width < 256 || stream.height < 256) throw new Error("This photo is too small. Please upload a photo at least 256 × 256 pixels.");
    await run(FFMPEG, ["-y", "-v", "error", "-i", src, "-frames:v", "1", "-vf", "scale='min(2048,iw)':'min(2048,ih)':force_original_aspect_ratio=decrease,format=yuvj420p", "-map_metadata", "-1", "-q:v", "2", out], { timeout: 60_000 });
    const buffer = await readFile(out);
    const outInfo = await probe(out);
    const s = outInfo.streams.find((x) => x.codec_type === "video")!;
    return { buffer, width: s.width!, height: s.height!, };
  });
}

/**
 * Fits the product photo into the exact output frame (1080×1920 or
 * 1920×1080) WITHOUT cropping the product: the photo is scaled to fit and
 * centred over a blurred, darkened copy of itself. This is the first frame
 * Veo animates from, so the product's real look is preserved.
 */
export async function buildFirstFrame(photo: Buffer, aspectRatio: "9:16" | "16:9"): Promise<Buffer> {
  const [w, h] = aspectRatio === "9:16" ? [1080, 1920] : [1920, 1080];
  return withTempDir(async (dir) => {
    const src = join(dir, "in.jpg");
    const out = join(dir, "frame.jpg");
    await writeFile(src, photo);
    const filter =
      `[0:v]split=2[bg][fg];` +
      `[bg]scale=${w}:${h}:force_original_aspect_ratio=increase,crop=${w}:${h},gblur=sigma=40,eq=brightness=-0.12:saturation=0.9[bgb];` +
      `[fg]scale=${Math.round(w * 0.92)}:${Math.round(h * 0.92)}:force_original_aspect_ratio=decrease[fgs];` +
      `[bgb][fgs]overlay=(W-w)/2:(H-h)/2,format=yuvj420p`;
    await run(FFMPEG, ["-y", "-v", "error", "-i", src, "-filter_complex", filter, "-frames:v", "1", "-q:v", "2", out], { timeout: 60_000 });
    return readFile(out);
  });
}

export interface VideoInfo {
  durationSeconds: number;
  width: number;
  height: number;
  hasAudio: boolean;
}

/** Proves the downloaded bytes are a real, playable video (not an error page or empty file). Throws otherwise. */
export async function inspectVideo(video: Buffer): Promise<VideoInfo> {
  return withTempDir(async (dir) => {
    const src = join(dir, "in.mp4");
    await writeFile(src, video);
    const info = await probe(src).catch(() => null);
    const v = info?.streams.find((s) => s.codec_type === "video");
    if (!info || !v?.width || !v?.height) throw new Error("Google returned a file that is not a playable video.");
    const durationSeconds = Number(info.format?.duration ?? 0);
    if (!(durationSeconds > 0)) throw new Error("Google returned a video with no duration.");
    return { durationSeconds, width: v.width, height: v.height, hasAudio: info.streams.some((s) => s.codec_type === "audio") };
  });
}

export async function makeThumbnail(video: Buffer, atSeconds: number): Promise<Buffer> {
  return withTempDir(async (dir) => {
    const src = join(dir, "in.mp4");
    const out = join(dir, "thumb.jpg");
    await writeFile(src, video);
    await run(FFMPEG, ["-y", "-v", "error", "-ss", String(Math.max(0, atSeconds)), "-i", src, "-frames:v", "1", "-vf", "scale='min(720,iw)':-2", "-q:v", "3", out], { timeout: 60_000 });
    return readFile(out);
  });
}

export interface OverlayText {
  productName?: string;
  price?: string;
  callToAction?: string;
}

function fontSizeFor(text: string, width: number, base: number): number {
  // Inter's average glyph width is ~0.58em; keep the line inside 88% of the frame.
  return Math.max(18, Math.floor(Math.min(base, (0.88 * width) / (Math.max(text.length, 1) * 0.58))));
}

/** ffmpeg filter-graph escaping for a value used inside drawtext's option list. */
function esc(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/:/g, "\\:").replace(/'/g, "\\'").replace(/,/g, "\\,").replace(/%/g, "\\%");
}

/**
 * Burns exact, deterministic text onto the video: product name at the top,
 * price and call-to-action near the bottom in the second half of the clip.
 * Text is read from files (textfile=), not the filter string, so no
 * customer input is ever parsed as ffmpeg syntax. Returns null if there is
 * nothing to draw.
 */
export async function burnOverlays(video: Buffer, info: VideoInfo, text: OverlayText): Promise<Buffer | null> {
  const name = (text.productName ?? "").trim().slice(0, 40);
  const price = (text.price ?? "").trim().slice(0, 24);
  const cta = (text.callToAction ?? "").trim().slice(0, 40);
  if (!name && !price && !cta) return null;

  return withTempDir(async (dir) => {
    const src = join(dir, "in.mp4");
    const out = join(dir, "out.mp4");
    await writeFile(src, video);
    const W = info.width;
    const H = info.height;
    const vertical = H > W;
    const filters: string[] = [];
    const showLate = Math.max(0, info.durationSeconds * 0.4).toFixed(2);

    if (name) {
      await writeFile(join(dir, "name.txt"), name);
      const fs = fontSizeFor(name, W, Math.round(W * (vertical ? 0.075 : 0.05)));
      filters.push(
        `drawtext=fontfile='${esc(FONT_EXTRABOLD)}':textfile='${esc(join(dir, "name.txt"))}':fontsize=${fs}:fontcolor=0xEDEAEC:` +
          `box=1:boxcolor=0x0A0908@0.62:boxborderw=${Math.round(fs * 0.45)}:x=(w-text_w)/2:y=h*${vertical ? 0.08 : 0.07}:` +
          `alpha='if(lt(t,0.3),t/0.3,1)'`,
      );
    }
    if (price) {
      await writeFile(join(dir, "price.txt"), price);
      const fs = fontSizeFor(price, W, Math.round(W * (vertical ? 0.1 : 0.065)));
      filters.push(
        `drawtext=fontfile='${esc(FONT_EXTRABOLD)}':textfile='${esc(join(dir, "price.txt"))}':fontsize=${fs}:fontcolor=0xD6A524:` +
          `borderw=${Math.max(2, Math.round(fs * 0.06))}:bordercolor=0x0A0908:x=(w-text_w)/2:y=h*${vertical ? 0.7 : 0.66}:enable='gte(t,${showLate})'`,
      );
    }
    if (cta) {
      await writeFile(join(dir, "cta.txt"), cta);
      const fs = fontSizeFor(cta, W * 0.9, Math.round(W * (vertical ? 0.062 : 0.042)));
      filters.push(
        `drawtext=fontfile='${esc(FONT_BOLD)}':textfile='${esc(join(dir, "cta.txt"))}':fontsize=${fs}:fontcolor=0x0A0908:` +
          `box=1:boxcolor=0xD6A524@0.96:boxborderw=${Math.round(fs * 0.55)}:x=(w-text_w)/2:y=h*${vertical ? 0.82 : 0.8}:enable='gte(t,${showLate})'`,
      );
    }

    const args = ["-y", "-v", "error", "-i", src, "-vf", filters.join(","), "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p", "-movflags", "+faststart"];
    if (info.hasAudio) args.push("-c:a", "copy");
    args.push(out);
    await run(FFMPEG, args, { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 });
    return readFile(out);
  });
}

/** Re-muxes Google's MP4 with the moov atom at the front so browsers can start playing before the whole file downloads. Lossless. */
export async function faststart(video: Buffer): Promise<Buffer> {
  return withTempDir(async (dir) => {
    const src = join(dir, "in.mp4");
    const out = join(dir, "out.mp4");
    await writeFile(src, video);
    await run(FFMPEG, ["-y", "-v", "error", "-i", src, "-c", "copy", "-movflags", "+faststart", out], { timeout: 120_000 });
    return readFile(out);
  });
}
