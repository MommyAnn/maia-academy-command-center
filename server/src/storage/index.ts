// Storage driver interface (spec section 18's "storage architecture
// recommended in the audit" — the audit recommended S3-compatible object
// storage with signed URLs for Staging/Production; LocalDiskDriver below is
// the Development-only stand-in behind the SAME interface, so swapping to
// S3 later touches this file only, never any route handler).

export interface StorageDriver {
  /** Persists file bytes under a private, non-guessable key and returns that key. */
  save(key: string, data: Buffer): Promise<void>;
  /** Reads file bytes back by key. Throws if the key does not exist. */
  read(key: string): Promise<Buffer>;
  /** Permanently deletes the file at this key, if present. */
  remove(key: string): Promise<void>;
}

export const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "application/pdf"] as const;
export const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB, matches the existing frontend limit

export function validateUpload(mimeType: string, sizeBytes: number): string | null {
  if (!(ALLOWED_MIME_TYPES as readonly string[]).includes(mimeType)) {
    return "Unsupported file type. Only JPG, PNG, or PDF is accepted.";
  }
  if (sizeBytes > MAX_UPLOAD_SIZE_BYTES) {
    return "File is too large. Maximum size is 10 MB.";
  }
  if (sizeBytes <= 0) {
    return "Empty file upload rejected.";
  }
  return null;
}
