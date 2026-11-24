import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { StorageDriver } from "./index.js";
import { env } from "../env.js";

// S3-compatible private-bucket driver (AWS S3, Cloudflare R2, Supabase
// Storage's S3 endpoint, Backblaze B2, MinIO...). The bucket must be
// PRIVATE: files are only ever served through this API's ownership-checked,
// signed download routes, never by public bucket URLs.

let client: S3Client | null = null;

function s3(): S3Client {
  if (!client) {
    client = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT || undefined,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY } : undefined,
    });
  }
  return client;
}

function bucket(): string {
  if (!env.S3_BUCKET) throw new Error("S3_BUCKET is not configured.");
  return env.S3_BUCKET;
}

function normalizeKey(key: string): string {
  if (key.includes("..")) throw new Error("Rejected storage key: path traversal attempt.");
  return key.replace(/\\/g, "/");
}

export const s3Driver: StorageDriver = {
  async save(key, data) {
    await s3().send(new PutObjectCommand({ Bucket: bucket(), Key: normalizeKey(key), Body: data, ServerSideEncryption: env.S3_ENDPOINT ? undefined : "AES256" }));
  },
  async read(key) {
    const res = await s3().send(new GetObjectCommand({ Bucket: bucket(), Key: normalizeKey(key) }));
    if (!res.Body) throw new Error("Stored file is empty or missing.");
    return Buffer.from(await res.Body.transformToByteArray());
  },
  async remove(key) {
    await s3().send(new DeleteObjectCommand({ Bucket: bucket(), Key: normalizeKey(key) }));
  },
};
