// Typed client for the AI Video Creator backend. Same-origin by default
// (Vite dev proxy / single-origin production); VITE_API_BASE_URL overrides.

export const API_BASE = (import.meta.env.VITE_VC_API_BASE_URL as string | undefined) ?? "";

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      credentials: "include",
      headers: { ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}), ...init.headers },
    });
  } catch {
    throw new ApiError(0, "Can't reach the server. Please check your internet connection and try again.");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}) as Record<string, string>);
    throw new ApiError(res.status, body.error ?? `Something went wrong (error ${res.status}).`, body.code);
  }
  return res.json() as Promise<T>;
}

const get = <T>(p: string) => request<T>(p);
const post = <T>(p: string, body?: unknown) => request<T>(p, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) });
const put = <T>(p: string, body: unknown) => request<T>(p, { method: "PUT", body: JSON.stringify(body) });
const del = <T>(p: string) => request<T>(p, { method: "DELETE" });

/** Media URLs from the API are relative; make them absolute against the API host. */
export function media(url: string | null | undefined): string | undefined {
  return url ? `${API_BASE}${url}` : undefined;
}

// ---- Types ---------------------------------------------------------------

export type VideoStyle = "PRODUCT_COMMERCIAL" | "UGC_PROMO" | "SALES_PROMOTION";
export type VideoLanguage = "ENGLISH" | "FILIPINO" | "TAGLISH";
export type JobStatus = "QUEUED" | "SUBMITTED" | "RUNNING" | "PROCESSING" | "COMPLETED" | "FAILED";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  studentId?: string;
}

export interface Me {
  user: { fullName: string; email: string };
  account: { accessStatus: "ACTIVE" | "SUSPENDED"; creditBalance: number };
  stats: { completed: number; inProgress: number; failed: number };
  service: { providerConnected: boolean; generationEnabled: boolean };
  options: {
    styles: VideoStyle[];
    languages: VideoLanguage[];
    aspectRatios: ("9:16" | "16:9")[];
    durations: number[];
    resolutions: string[];
    creditCost: Record<string, number>;
    defaultCta: Record<VideoLanguage, string>;
  };
}

export interface ProductDetails {
  productName?: string;
  description?: string;
  benefits?: string;
  price?: string;
  targetAudience?: string;
  callToAction?: string;
}

export interface Video {
  id: string;
  displayId: string;
  status: JobStatus;
  statusMessage: string | null;
  warningMessage: string | null;
  style: VideoStyle;
  language: VideoLanguage;
  aspectRatio: "9:16" | "16:9";
  durationSeconds: number;
  resolution: string;
  product: ProductDetails;
  overlay: boolean;
  voiceover: boolean;
  creditsCharged: number;
  creditStatus: "CHARGED" | "REFUNDED" | null;
  createdAt: string;
  submittedAt: string | null;
  completedAt: string | null;
  failureCategory: string | null;
  media: { videoUrl: string | null; downloadUrl: string | null; originalDownloadUrl: string | null; thumbnailUrl: string | null; hasTextOverlay: boolean } | null;
  photoUrl: string | null;
}

export interface CreditTransaction {
  id: string;
  type: "GRANT" | "ADJUSTMENT" | "GENERATION_CHARGE" | "GENERATION_REFUND";
  amount: number;
  balanceAfter: number;
  reason: string | null;
  jobId: string | null;
  jobDisplayId?: string | null;
  createdAt: string;
}

export interface CreateVideoPayload {
  productPhotoId: string;
  style: VideoStyle;
  language: VideoLanguage;
  aspectRatio: "9:16" | "16:9";
  durationSeconds: number;
  resolution: string;
  product: ProductDetails;
  overlay: boolean;
  voiceover: boolean;
  customInstructions?: string;
  idempotencyKey: string;
}

// ---- Customer ------------------------------------------------------------

export const authApi = {
  me: () => get<{ user: SessionUser }>("/api/auth/me"),
  login: (email: string, password: string) => post<{ user: SessionUser }>("/api/auth/login", { email, password }),
  logout: () => post<{ ok: true }>("/api/auth/logout"),
  requestReset: (email: string) => post<{ ok: true; devOnlyResetToken?: string }>("/api/auth/request-password-reset", { email }),
  completeReset: (token: string, newPassword: string) => post<{ ok: true }>("/api/auth/complete-password-reset", { token, newPassword }),
  changePassword: (currentPassword: string, newPassword: string) => post<{ ok: true }>("/api/video-creator/account/password", { currentPassword, newPassword }),
};

export const vcApi = {
  me: () => get<Me>("/api/video-creator/me"),
  transactions: () => get<{ balance: number; transactions: CreditTransaction[] }>("/api/video-creator/credits/transactions"),
  uploadPhoto: (filename: string, contentBase64: string) => post<{ photo: { id: string; width: number; height: number; previewUrl: string } }>("/api/video-creator/photos", { filename, contentBase64 }),
  createVideo: (payload: CreateVideoPayload) => post<{ video: Video; duplicate: boolean }>("/api/video-creator/videos", payload),
  videos: (params: { search?: string; status?: string; style?: string; limit?: number } = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined && v !== "") as [string, string][]);
    return get<{ videos: Video[] }>(`/api/video-creator/videos?${q}`);
  },
  video: (id: string) => get<{ video: Video }>(`/api/video-creator/videos/${encodeURIComponent(id)}`),
  deleteVideo: (id: string) => del<{ ok: true }>(`/api/video-creator/videos/${encodeURIComponent(id)}`),
};

// ---- Admin ---------------------------------------------------------------

export interface AdminCustomer {
  studentId: string;
  displayId: string;
  fullName: string;
  email: string | null;
  loginStatus: string;
  lastLoginAt: string | null;
  accessStatus: "ACTIVE" | "SUSPENDED";
  creditBalance: number;
  purchaseReference: string | null;
  notes: string | null;
  activatedAt: string | null;
  videos: { completed: number; failed: number };
  createdAt: string;
}

export interface AdminJob extends Video {
  customer: { studentId: string; fullName: string };
  model: string;
  errorCategory: string | null;
  errorMessage: string | null;
  submitAttempts: number;
  estimatedCostUsd: number | null;
  deletedAt: string | null;
  prompt?: string;
  negativePrompt?: string;
  operationName?: string | null;
  pollFailures?: number;
  firstFrameUrl?: string | null;
}

export interface AdminSettings {
  generationEnabled: boolean;
  activeModel: string | null;
  creditsPerVideo: number;
  extraCreditsFor1080p: number;
  defaultStartingCredits: number;
  maxActiveJobsPerUser: number;
  maxActiveJobsGlobal: number;
  allowedDurations: number[];
  allowedResolutions: string[];
  modelPricing: Record<string, { "720p"?: number; "1080p"?: number }>;
  updatedAt?: string;
}

export interface AdminOverview {
  provider: { connected: boolean; activeModel: string; generationEnabled: boolean };
  customers: { active: number; total: number };
  jobs: { total: number; completed: number; failed: number; inProgress: number; successRate: number | null };
  timing: { medianSeconds: number | null; p90Seconds: number | null; sampleSize: number };
  usage: { secondsGeneratedLast30Days: number; estimatedCostUsdLast30Days: number; secondsGeneratedAllTime: number; estimatedCostUsdAllTime: number };
  credits: Record<string, { total: number; count: number }>;
  perDay: { day: string; completed: number; failed: number }[];
  recentFailures: { id: string; displayId: string; customer: string; errorCategory: string | null; errorMessage: string | null; createdAt: string }[];
}

export const adminApi = {
  overview: () => get<AdminOverview>("/api/video-creator/admin/overview"),
  customers: (search?: string) => get<{ customers: AdminCustomer[] }>(`/api/video-creator/admin/customers${search ? `?search=${encodeURIComponent(search)}` : ""}`),
  createCustomer: (body: { fullName: string; email: string; initialCredits?: number; purchaseReference?: string; notes?: string }) =>
    post<{ studentId: string; email: string; temporaryPassword: string; creditBalance: number; loginUrl: string }>("/api/video-creator/admin/customers", body),
  activate: (studentId: string) => post<{ ok: true }>(`/api/video-creator/admin/customers/${studentId}/activate`, {}),
  suspend: (studentId: string) => post<{ ok: true }>(`/api/video-creator/admin/customers/${studentId}/suspend`, {}),
  adjustCredits: (studentId: string, amount: number, reason: string, idempotencyKey: string) => post<{ balance: number; applied: boolean }>(`/api/video-creator/admin/customers/${studentId}/credits`, { amount, reason, idempotencyKey }),
  customerTransactions: (studentId: string) => get<{ balance: number; transactions: CreditTransaction[] }>(`/api/video-creator/admin/customers/${studentId}/transactions`),
  resetLink: (studentId: string) => post<{ url: string; expiresInHours: number }>(`/api/video-creator/admin/customers/${studentId}/reset-link`),
  jobs: (params: { status?: string; search?: string; studentId?: string } = {}) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return get<{ jobs: AdminJob[] }>(`/api/video-creator/admin/jobs?${q}`);
  },
  job: (id: string) => get<{ job: AdminJob; ledger: CreditTransaction[] }>(`/api/video-creator/admin/jobs/${id}`),
  retryJob: (id: string) => post<{ ok: true }>(`/api/video-creator/admin/jobs/${id}/retry`),
  refundJob: (id: string, reason: string) => post<{ ok: true }>(`/api/video-creator/admin/jobs/${id}/refund`, { reason }),
  settings: () => get<{ settings: AdminSettings; effectiveModel: string; envDefaultModel: string; knownDurations: number[]; knownResolutions: string[]; providerConnected: boolean; emailConfigured: boolean }>("/api/video-creator/admin/settings"),
  saveSettings: (s: AdminSettings) => put<{ settings: AdminSettings; effectiveModel: string }>("/api/video-creator/admin/settings", s),
  checkProvider: () =>
    post<{ connected: boolean; errorCategory?: string; message?: string; activeModel?: string; activeModelAvailable?: boolean; models?: { id: string; displayName?: string; description?: string; supportsVideoGeneration: boolean }[] }>("/api/video-creator/admin/provider/check"),
  runWorker: () => post<{ processed: number }>("/api/video-creator/admin/worker/run"),
  audit: () => get<{ entries: { id: string; action: string; summary: string; createdAt: string }[] }>("/api/video-creator/admin/audit"),
};

export function newIdempotencyKey(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
