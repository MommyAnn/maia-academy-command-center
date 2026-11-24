import clsx from "clsx";
import { ImagePlus, Loader2, RefreshCw } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";
import { ApiError, vcApi } from "../api";
import { Alert } from "./ui";

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif";
const MAX_INPUT_BYTES = 25 * 1024 * 1024;

/**
 * Converts any photo the browser can decode (incl. iPhone HEIC on Safari) to
 * a correctly-rotated JPEG, max 2048px. Keeps uploads small on mobile data;
 * the server still re-validates and re-encodes everything.
 */
async function prepareImage(file: File): Promise<{ base64: string; previewUrl: string }> {
  let bitmap: ImageBitmap | null = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    bitmap = null;
  }
  if (!bitmap) {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("This photo format isn't supported by your browser. Please use a JPG or PNG photo.");
    const buf = new Uint8Array(await file.arrayBuffer());
    return { base64: toBase64(buf), previewUrl: URL.createObjectURL(file) };
  }
  const scale = Math.min(1, 2048 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#ffffff"; // transparent PNGs -> white, not black
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob: Blob = await new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Could not process this photo."))), "image/jpeg", 0.92));
  return { base64: toBase64(new Uint8Array(await blob.arrayBuffer())), previewUrl: URL.createObjectURL(blob) };
}

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export interface UploadedPhoto {
  id: string;
  previewUrl: string;
  width: number;
  height: number;
  name: string;
}

export function PhotoDropzone({ value, onChange, disabled }: { value: UploadedPhoto | null; onChange: (p: UploadedPhoto | null) => void; disabled?: boolean }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handle(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (file.size > MAX_INPUT_BYTES) return setError("This photo is too large (over 25 MB). Please choose a smaller photo.");
    if (file.type && !file.type.startsWith("image/")) return setError("Please choose a photo (JPG, PNG or WebP).");
    setBusy(true);
    try {
      const prepared = await prepareImage(file);
      const { photo } = await vcApi.uploadPhoto(file.name || "product.jpg", prepared.base64);
      onChange({ id: photo.id, previewUrl: prepared.previewUrl, width: photo.width, height: photo.height, name: file.name });
    } catch (e) {
      setError(e instanceof ApiError || e instanceof Error ? e.message : "Upload failed. Please try again.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(e: DragEvent) {
    e.preventDefault();
    setDragging(false);
    if (!disabled) void handle(e.dataTransfer.files?.[0]);
  }

  return (
    <div>
      <input ref={inputRef} type="file" accept={ACCEPT} className="hidden" onChange={(e) => void handle(e.target.files?.[0])} data-testid="photo-input" />
      {value ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <div className="relative mx-auto w-48 shrink-0 overflow-hidden rounded-2xl border border-vc-gold/40 bg-white sm:mx-0">
            <img src={value.previewUrl} alt="Your product" className="aspect-square w-full object-contain" />
            {busy && (
              <div className="absolute inset-0 flex items-center justify-center bg-vc-black/60">
                <Loader2 className="h-6 w-6 animate-spin text-vc-gold" />
              </div>
            )}
          </div>
          <div className="text-center sm:text-left">
            <p className="font-semibold text-vc-success">✓ Photo uploaded</p>
            <p className="mt-0.5 break-all text-sm text-vc-muted">
              {value.name} · {value.width}×{value.height}
            </p>
            <button type="button" disabled={disabled || busy} onClick={() => inputRef.current?.click()} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-vc-border px-3 py-2 text-sm text-vc-ivory hover:border-vc-gold/60">
              <RefreshCw className="h-4 w-4" /> Change photo
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          className={clsx(
            "flex w-full flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition",
            dragging ? "border-vc-gold-bright bg-vc-gold/10" : "border-vc-gold/40 bg-vc-black hover:border-vc-gold hover:bg-vc-gold/5",
          )}
        >
          {busy ? <Loader2 className="h-10 w-10 animate-spin text-vc-gold" /> : <ImagePlus className="h-10 w-10 text-vc-gold" />}
          <p className="mt-4 font-display text-lg font-bold text-vc-ivory">{busy ? "Uploading your photo…" : "Upload Product Photo"}</p>
          <p className="mt-1 text-sm text-vc-muted">
            <span className="hidden sm:inline">Drag & drop here, or </span>
            <span className="font-semibold text-vc-gold">tap to browse</span>
          </p>
          <p className="mt-3 text-xs text-vc-dim">JPG, PNG or WebP · up to 10 MB · a clear photo on a plain background works best</p>
        </button>
      )}
      {error && (
        <div className="mt-3">
          <Alert kind="error">{error}</Alert>
        </div>
      )}
    </div>
  );
}
