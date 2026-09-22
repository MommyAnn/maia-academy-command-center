// Typed client for the real Phase 2 backend (server/). This is the ONLY
// place in the frontend that talks to that backend — every call goes
// through `apiRequest`, always with credentials: 'include' so the
// httpOnly session cookie from POST /api/auth/login is sent automatically.
//
// This client is additive: importing it does not change any existing
// page's behavior. Only code that explicitly calls one of the functions
// below touches the real backend; everything else in the app keeps using
// the existing localStorage-backed stores untouched.

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? "http://localhost:4000";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new ApiError(res.status, body.error ?? `Request failed with status ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function get<T>(path: string): Promise<T> {
  return apiRequest<T>(path, { method: "GET" });
}

function post<T>(path: string, payload?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "POST", body: payload !== undefined ? JSON.stringify(payload) : undefined });
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface ApiAuthUser {
  userId: string;
  fullName: string;
  roleName?: string;
  studentId?: string;
}

export const authApi = {
  login: (email: string, password: string) => post<{ user: ApiAuthUser }>("/api/auth/login", { email, password }),
  logout: () => post<void>("/api/auth/logout"),
  me: () => get<{ user: ApiAuthUser }>("/api/auth/me"),
};

// ---------------------------------------------------------------------------
// Dashboard (spec section 34 — real KPIs, never hard-coded)
// ---------------------------------------------------------------------------

export interface DashboardSummary {
  totalStudents: number;
  newEnrollments: number;
  verifiedCollections: number;
  receivables: number;
  pendingPaymentVerification: number;
  fullyPaidStudents: number;
  studentsWithBalance: number;
}

export const dashboardApi = {
  summary: (range?: { from?: string; to?: string }) => {
    const params = new URLSearchParams();
    if (range?.from) params.set("from", range.from);
    if (range?.to) params.set("to", range.to);
    const qs = params.toString();
    return get<{ summary: DashboardSummary }>(`/api/dashboard/summary${qs ? `?${qs}` : ""}`);
  },
};

// ---------------------------------------------------------------------------
// Finance
// ---------------------------------------------------------------------------

export interface ApiFinanceSummary {
  verifiedPaid: number;
  pending: number;
  netAmountDue: number;
  balance: number;
  status: "Unpaid" | "Partial Payment" | "Fully Paid" | "Pending Verification";
}

export interface ApiPaymentTransaction {
  id: string;
  paymentDisplayId: string;
  amount: number;
  method: string;
  type: string;
  status: "PENDING_VERIFICATION" | "VERIFIED" | "REJECTED" | "CANCELLED";
  paymentDate: string;
  referenceNumber: string | null;
  rejectedReason: string | null;
}

export const financeApi = {
  summary: (studentId: string) => get<{ summary: ApiFinanceSummary }>(`/api/students/${studentId}/finance-summary`),
  payments: (studentId: string) => get<{ payments: ApiPaymentTransaction[] }>(`/api/students/${studentId}/payments`),
  submitPayment: (studentId: string, payload: { amount: number; method: string; type: string; referenceNumber?: string; proofDocumentId?: string }) =>
    post<{ payment: ApiPaymentTransaction }>(`/api/students/${studentId}/payments`, payload),
};

// ---------------------------------------------------------------------------
// Requirements
// ---------------------------------------------------------------------------

export interface ApiRequirementReview {
  id: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  reason: string | null;
  occurredAt: string;
}

export interface ApiRequirement {
  id: string;
  type: string;
  status: "PENDING" | "VERIFIED" | "REJECTED";
  submittedAt: string | null;
  reasonNote: string | null;
  reviews: ApiRequirementReview[];
}

export const requirementsApi = {
  list: (studentId: string) => get<{ requirements: ApiRequirement[] }>(`/api/students/${studentId}/requirements`),
  submit: (studentId: string, type: string, documentId: string) =>
    post<{ requirement: ApiRequirement }>(`/api/students/${studentId}/requirements/${type}/submit`, { documentId }),
};

// ---------------------------------------------------------------------------
// Students / Enrollment
// ---------------------------------------------------------------------------

export interface ApiStudent {
  id: string;
  studentDisplayId: string;
  fullName: string;
  email: string | null;
  batch: string;
  package: string;
  enrollmentStatus: string;
  masterBrainStatus: string;
}

export const studentsApi = {
  get: (studentId: string) => get<{ student: ApiStudent }>(`/api/students/${studentId}`),
};

// ---------------------------------------------------------------------------
// Documents (secure upload, used to obtain a documentId for requirement submission)
// ---------------------------------------------------------------------------

export const documentsApi = {
  upload: (studentId: string, payload: { documentType: string; filename: string; mimeType: string; contentBase64: string }) =>
    post<{ document: { id: string; documentType: string; status: string } }>(`/api/students/${studentId}/documents`, payload),
};
