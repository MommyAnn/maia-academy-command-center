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
  // Only set Content-Type when a body is actually being sent — a bodyless
  // POST (e.g. logout, apply-as-affiliate) with this header still present
  // makes Fastify's JSON body parser reject the empty body with a 400,
  // even though no JSON was ever intended.
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: "include",
    headers: { ...(init?.body !== undefined ? { "Content-Type": "application/json" } : {}), ...init?.headers },
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

function patch<T>(path: string, payload?: unknown): Promise<T> {
  return apiRequest<T>(path, { method: "PATCH", body: payload !== undefined ? JSON.stringify(payload) : undefined });
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

// ---------------------------------------------------------------------------
// M.A.I.A. Intelligence (Production Phase 10) — this app's own login
// (AuthContext) does not sign into the real backend (see
// ProductionBackendKpiCard's disclosure); this module's page therefore
// authenticates against server/ directly via authApi.login before calling
// any of these. Every number returned is real and DB-derived; nothing here
// is fabricated client-side.
// ---------------------------------------------------------------------------

export interface ApiIntelligenceSignal {
  id: string;
  ruleId: string;
  domain: string;
  entityType: string;
  entityId: string;
  severity: string;
  title: string;
  explanation: string;
  evidenceJson: Record<string, unknown>;
  detectedAt: string;
  status: string;
  resolution: string | null;
  rule: { ruleKey: string; name: string; recommendation: string };
}

export interface ApiIntelligenceRule {
  id: string;
  ruleKey: string;
  name: string;
  domain: string;
  description: string;
  triggerType: string;
  thresholdJson: Record<string, unknown>;
  severity: string;
  recommendation: string;
  active: boolean;
}

export interface ApiTodaysPriority {
  id: string;
  severity: string;
  domain: string;
  title: string;
  explanation: string;
  evidence: Record<string, unknown>;
  entityType: string;
  entityId: string;
  recommendation: string;
  ruleKey: string;
  detectedAt: string;
  status: string;
}

export interface ApiDailyBrief {
  rangeDays: number;
  since: string;
  facts: Record<string, number>;
  calculatedMetrics: Record<string, number>;
  ruleBasedSignals: { openByseverity: Record<string, number>; totalOpen: number };
  generatedAt: string;
}

export const intelligenceApi = {
  priorities: () => get<{ priorities: ApiTodaysPriority[] }>("/api/intelligence/priorities"),
  dailyBrief: (rangeDays = 1) => get<{ brief: ApiDailyBrief }>(`/api/intelligence/daily-brief?rangeDays=${rangeDays}`),
  signals: (filters?: { domain?: string; severity?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.domain) params.set("domain", filters.domain);
    if (filters?.severity) params.set("severity", filters.severity);
    if (filters?.status) params.set("status", filters.status);
    const qs = params.toString();
    return get<{ signals: ApiIntelligenceSignal[] }>(`/api/intelligence/signals${qs ? `?${qs}` : ""}`);
  },
  resolveSignal: (signalId: string, resolution: string) => post<{ signal: ApiIntelligenceSignal }>(`/api/intelligence/signals/${signalId}/resolve`, { resolution }),
  dismissSignal: (signalId: string, resolution: string) => post<{ signal: ApiIntelligenceSignal }>(`/api/intelligence/signals/${signalId}/dismiss`, { resolution }),
  rules: () => get<{ rules: ApiIntelligenceRule[] }>("/api/intelligence/rules"),
  updateRule: (ruleId: string, payload: { active?: boolean; severity?: string; thresholdJson?: Record<string, unknown> }) =>
    patch<{ rule: ApiIntelligenceRule }>(`/api/intelligence/rules/${ruleId}`, payload),
  evaluateNow: () => post<{ summaries: Array<{ ruleKey: string; candidatesFound: number; signalsCreated: number; signalsAutoResolved: number }> }>("/api/intelligence/evaluate"),
  ask: (question: string) =>
    post<{ answer: string; facts: Record<string, unknown>; source: string; aiPhrased: boolean; matched: boolean }>("/api/intelligence/ask", { question }),
};

// ---------------------------------------------------------------------------
// M.A.I.A. Business OS (Production Phase 15) — same self-authenticating
// pattern as intelligenceApi above. Every figure is real and DB-derived;
// this client only reads/writes the real backend's own Business OS routes,
// never fabricates a value client-side.
// ---------------------------------------------------------------------------

export interface ApiBusiness {
  id: string;
  name: string;
  stage: string | null;
  uiExperienceLevel: string;
  createdAt: string;
}

export interface ApiHealthCategory {
  category: string;
  status: "SETUP_REQUIRED" | "NEEDS_ATTENTION" | "OPERATIONAL" | "INSUFFICIENT_DATA";
  reason: string;
}

export interface ApiActionItem {
  type: string;
  title: string;
  entityType: string;
  entityId: string;
}

export interface ApiGoal {
  id: string;
  goalDisplayId: string;
  name: string;
  type: string;
  target: string;
  unit: string;
  currentValue: string;
  dataSource: string;
  status: string;
  statusReason?: string;
  startDate: string;
  targetDate: string;
}

export interface ApiBusinessHome {
  business: { id: string; name: string; stage: string | null; uiExperienceLevel: string };
  health: ApiHealthCategory[];
  actionItems: ApiActionItem[];
  goals: ApiGoal[];
  salesSnapshot: { openOpportunityCount: number };
  marketingSnapshot: { activeCampaignCount: number };
}

export interface ApiBusinessContact {
  id: string;
  contactDisplayId: string;
  pipelineStageKey: string;
  status: string;
  person: { fullName: string; email: string | null };
}

export interface ApiOpportunity {
  id: string;
  opportunityDisplayId: string;
  pipelineStageKey: string;
  estimatedValue: string | null;
  status: string;
  contact?: { person: { fullName: string } };
}

export type ApiAskBusinessResult =
  | { ok: true; kind: "FACT"; answer: string; facts: Record<string, unknown>; aiPhrased: boolean }
  | { ok: true; kind: "ROUTE"; module: string; guidance: string };

export const businessOsApi = {
  // Reuses the existing Phase 6 Master Brain endpoint — Business OS does
  // not duplicate business listing.
  listBusinesses: (studentId: string) => get<{ businesses: ApiBusiness[] }>(`/api/students/${studentId}/businesses`),
  setStage: (businessId: string, stage: string | null) => patch<{ business: ApiBusiness }>(`/api/businesses/${businessId}/stage`, { stage }),
  setUiExperienceLevel: (businessId: string, uiExperienceLevel: "GUIDED" | "ADVANCED") =>
    patch<{ business: ApiBusiness }>(`/api/businesses/${businessId}/ui-experience-level`, { uiExperienceLevel }),

  home: (businessId: string) => get<ApiBusinessHome>(`/api/businesses/${businessId}/home`),
  health: (businessId: string) => get<{ categories: ApiHealthCategory[] }>(`/api/businesses/${businessId}/health`),
  actionCenter: (businessId: string) => get<{ items: ApiActionItem[] }>(`/api/businesses/${businessId}/action-center`),
  dailyBrief: (businessId: string) => get<Record<string, unknown>>(`/api/businesses/${businessId}/daily-brief`),

  contacts: (businessId: string) => get<{ contacts: ApiBusinessContact[] }>(`/api/businesses/${businessId}/business-contacts`),
  createContact: (studentId: string, payload: { businessId: string; fullName: string; email?: string; contactNumber?: string; source?: string }) =>
    post<{ contact: ApiBusinessContact }>(`/api/students/${studentId}/business-contacts`, payload),

  opportunities: (businessId: string) => get<{ opportunities: ApiOpportunity[] }>(`/api/businesses/${businessId}/opportunities`),
  createOpportunity: (studentId: string, payload: { businessId: string; contactId: string; estimatedValue?: number; nextAction?: string }) =>
    post<{ opportunity: ApiOpportunity }>(`/api/students/${studentId}/opportunities`, payload),

  goals: (businessId: string) => get<{ goals: ApiGoal[] }>(`/api/businesses/${businessId}/goals`),
  createGoal: (studentId: string, payload: { businessId: string; name: string; type: string; target: number; unit: string; startDate: string; targetDate: string; dataSource?: string }) =>
    post<{ goal: ApiGoal }>(`/api/students/${studentId}/goals`, payload),
  updateGoalProgress: (goalId: string, currentValue: number) => patch<{ goal: ApiGoal }>(`/api/goals/${goalId}/progress`, { currentValue }),

  financeSummary: (businessId: string) => get<{ totalRevenue: number; totalExpenses: number; netCash: number; label: string }>(`/api/businesses/${businessId}/finance-summary`),

  ask: (businessId: string, question: string) => post<ApiAskBusinessResult>(`/api/businesses/${businessId}/ask`, { question }),
};

// ---------------------------------------------------------------------------
// M.A.I.A. Productization / Entitlements (Production Phase 16)
// ---------------------------------------------------------------------------

export interface ApiFeature {
  id: string;
  featureKey: string;
  name: string;
  description: string | null;
  category: string | null;
}

export interface ApiFeatureGrant {
  featureKey: string;
  usageLimit?: number;
  usagePeriod?: string;
  businessLimit?: number;
  teamSeatLimit?: number;
}

export interface ApiCommerceProduct {
  id: string;
  productDisplayId: string;
  name: string;
  description: string | null;
  type: string;
  status: string;
  billingType: string;
  basePrice: string | null;
  currency: string;
  accessDurationDays: number | null;
  visibility: string;
  includesProductIds: string[];
  entitlementsJson: ApiFeatureGrant[];
  createdAt: string;
}

export interface ApiEntitlement {
  id: string;
  entitlementDisplayId: string;
  studentId: string;
  businessId: string | null;
  featureKey: string;
  source: string;
  sourceProductId: string | null;
  product?: ApiCommerceProduct | null;
  sourceRecordId: string | null;
  startDate: string;
  endDate: string | null;
  status: string;
  usageLimit: number | null;
  usagePeriod: string | null;
  overrideReason: string | null;
  createdAt: string;
}

export interface ApiEntitlementWithStatus extends ApiEntitlement {
  resolvedDecision: string;
  usage?: { used: number; limit: number; periodKey: string } | null;
}

export interface ApiPurchase {
  id: string;
  purchaseDisplayId: string;
  studentId: string;
  productId: string;
  product?: ApiCommerceProduct;
  priceAtPurchase: string;
  currency: string;
  checkoutMode: string;
  paymentMethod: string | null;
  referenceNumber: string | null;
  status: string;
  activatedAt: string | null;
  createdAt: string;
}

export interface ApiSubscription {
  id: string;
  subscriptionDisplayId: string;
  studentId: string;
  productId: string;
  product?: ApiCommerceProduct;
  provider: string;
  status: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  cancelAtPeriodEnd: boolean;
  gracePeriodEndsAt: string | null;
}

export interface ApiPromotion {
  id: string;
  code: string | null;
  name: string;
  type: string;
  valueJson: { amount?: number; percent?: number };
  usageLimit: number | null;
  redeemedCount: number;
}

export interface ApiMyAccessView {
  entitlements: ApiEntitlementWithStatus[];
  purchases: ApiPurchase[];
  subscriptions: ApiSubscription[];
}

export interface ApiResolveResult {
  decision: string;
  reason: string;
  entitlementId?: string;
  usage?: { used: number; limit: number; periodKey: string } | null;
}

export const entitlementsApi = {
  // --- Catalog (admin) ---------------------------------------------------
  features: () => get<{ features: ApiFeature[] }>("/api/entitlements/features"),
  products: (filters?: { type?: string; status?: string }) => {
    const params = new URLSearchParams();
    if (filters?.type) params.set("type", filters.type);
    if (filters?.status) params.set("status", filters.status);
    const qs = params.toString();
    return get<{ products: ApiCommerceProduct[] }>(`/api/entitlements/products${qs ? `?${qs}` : ""}`);
  },
  product: (id: string) => get<{ product: ApiCommerceProduct }>(`/api/entitlements/products/${id}`),
  // Student Marketplace — any authenticated Student or staff member may
  // call this; it is hard-scoped server-side to ACTIVE + PUBLIC products,
  // unlike `products` above which requires the admin "Product Catalog" permission.
  catalog: () => get<{ products: ApiCommerceProduct[] }>("/api/entitlements/catalog"),
  productComparison: (id: string) => get<{ product: Pick<ApiCommerceProduct, "id" | "name" | "basePrice" | "currency" | "type">; features: ApiFeatureGrant[] }>(`/api/entitlements/products/${id}/comparison`),
  createProduct: (payload: {
    name: string;
    description?: string;
    type: string;
    billingType?: string;
    basePrice?: number;
    currency?: string;
    accessDurationDays?: number;
    visibility?: string;
    includesProductIds?: string[];
    entitlementsJson?: ApiFeatureGrant[];
  }) => post<{ product: ApiCommerceProduct }>("/api/entitlements/products", payload),
  updateProduct: (id: string, payload: { status?: string; basePrice?: number; description?: string; entitlementsJson?: ApiFeatureGrant[]; includesProductIds?: string[] }) =>
    patch<{ product: ApiCommerceProduct }>(`/api/entitlements/products/${id}`, payload),

  promotions: () => get<{ promotions: ApiPromotion[] }>("/api/entitlements/promotions"),
  createPromotion: (payload: { code?: string; name: string; type: string; valueJson: Record<string, unknown>; startAt?: string; endAt?: string; usageLimit?: number; productScopeJson?: string[] }) =>
    post<{ promotion: ApiPromotion }>("/api/entitlements/promotions", payload),

  upgradeRules: () => get<{ rules: unknown[] }>("/api/entitlements/upgrade-rules"),

  billingStatus: () => get<{ provider: string; connected: boolean; realCheckoutModes: string[]; architectureOnlyModes: string[]; message: string }>("/api/entitlements/billing-status"),

  // --- Student Access Center ----------------------------------------------
  myAccess: (studentId: string) => get<ApiMyAccessView>(`/api/students/${studentId}/my-access`),
  resolve: (studentId: string, featureKey: string, businessId?: string) =>
    get<ApiResolveResult>(`/api/students/${studentId}/my-access/${featureKey}${businessId ? `?businessId=${businessId}` : ""}`),

  // --- Admin Customer Access ----------------------------------------------
  adminAccess: (studentId: string) => get<ApiMyAccessView>(`/api/admin/students/${studentId}/access`),
  accessHealth: () => get<{ active: number; expiringSoon: number; expired: number; suspended: number; overrides: number; subscriptionsPastDue: number; generatedAt: string }>("/api/admin/entitlements/access-health"),
  grantOverride: (payload: { studentId: string; businessId?: string; featureKey: string; reason: string; endDate?: string; usageLimit?: number; usagePeriod?: string }) =>
    post<{ entitlement: ApiEntitlement }>("/api/admin/entitlements/grant", payload),
  revokeEntitlement: (id: string, reason: string) => post<{ entitlement: ApiEntitlement }>(`/api/admin/entitlements/${id}/revoke`, { reason }),
  suspendEntitlement: (id: string, reason: string) => post<{ entitlement: ApiEntitlement }>(`/api/admin/entitlements/${id}/suspend`, { reason }),

  // --- Checkout ------------------------------------------------------------
  purchases: (studentId: string) => get<{ purchases: ApiPurchase[] }>(`/api/students/${studentId}/purchases`),
  createPurchase: (studentId: string, payload: { productId: string; businessId?: string; promotionCode?: string; checkoutMode?: string }) =>
    post<{ purchase: ApiPurchase }>(`/api/students/${studentId}/purchases`, payload),
  submitPayment: (purchaseId: string, payload: { paymentMethod: string; referenceNumber?: string; proofDocumentId?: string }) =>
    post<{ purchase: ApiPurchase }>(`/api/purchases/${purchaseId}/submit-payment`, payload),
  verifyPurchase: (purchaseId: string) => post<{ purchase: ApiPurchase }>(`/api/purchases/${purchaseId}/verify`),
  activatePurchase: (purchaseId: string) => post<{ purchase: ApiPurchase; entitlements: ApiEntitlement[]; alreadyActivated: boolean }>(`/api/purchases/${purchaseId}/activate`),
  cancelPurchase: (purchaseId: string, reason: string) => post<{ purchase: ApiPurchase }>(`/api/purchases/${purchaseId}/cancel`, { reason }),

  subscriptions: (studentId: string) => get<{ subscriptions: ApiSubscription[] }>(`/api/students/${studentId}/subscriptions`),

  // --- Upgrade / Downgrade -------------------------------------------------
  upgradePreview: (studentId: string, toProductId: string, fromProductId?: string) =>
    get<{ currentProduct: ApiCommerceProduct | null; newProduct: ApiCommerceProduct; addedFeatures: ApiFeatureGrant[]; retainedFeatures: ApiFeatureGrant[]; upgradePrice: number; priceNote: string }>(
      `/api/students/${studentId}/upgrade-preview?toProductId=${toProductId}${fromProductId ? `&fromProductId=${fromProductId}` : ""}`,
    ),
  upgrade: (studentId: string, payload: { toProductId: string; fromProductId?: string }) => post<{ purchase: ApiPurchase; priceNote: string }>(`/api/students/${studentId}/upgrade`, payload),
  downgradePreview: (studentId: string, toProductId: string) =>
    get<{ newProduct: ApiCommerceProduct; currentBusinessCount: number; newBusinessLimit: number | null; warnings: string[]; safeToApply: boolean }>(`/api/students/${studentId}/downgrade-preview?toProductId=${toProductId}`),
  downgrade: (studentId: string, payload: { fromProductId: string; toProductId: string; acknowledgeDataRetained: true }) =>
    post<{ revokedCount: number; newEntitlements: ApiEntitlement[] }>(`/api/students/${studentId}/downgrade`, payload),
  packageHistory: (studentId: string) => get<{ events: unknown[] }>(`/api/students/${studentId}/package-history`),

  // --- Legacy migration + reconciliation (admin) ---------------------------
  migrationDryRun: () => get<{ studentsScanned: number; rows: unknown[] }>("/api/admin/entitlements/migration-dry-run"),
  confirmPackageMapping: (id: string) => post<{ mapping: unknown }>(`/api/admin/package-mappings/${id}/confirm`),
  applyPackageMapping: (id: string, studentId: string) => post<{ entitlements: ApiEntitlement[] }>(`/api/admin/package-mappings/${id}/apply-to-student`, { studentId, confirm: true }),
  reconciliation: () => get<{ generatedAt: string; flaggedCount: number; results: { category: string; detail: string; entityType: string; entityId: string }[] }>("/api/admin/entitlements/reconciliation"),
};

// ---------------------------------------------------------------------------
// M.A.I.A. Commerce & Growth Engine (Production Phase 17)
// ---------------------------------------------------------------------------

export interface ApiAffiliate {
  id: string;
  affiliateDisplayId: string;
  personId: string;
  status: string;
  referralCode: string;
  commissionPlanId: string | null;
  payoutDetailsStatus: string;
  createdAt: string;
}

export interface ApiCommissionPlan {
  id: string;
  name: string;
  type: string;
  rate: string | null;
  fixedAmount: string | null;
}

export interface ApiCommission {
  id: string;
  commissionDisplayId: string;
  affiliateId: string;
  purchaseId: string;
  status: string;
  commissionAmount: string;
  createdAt: string;
}

export interface ApiPayoutBatch {
  id: string;
  payoutBatchDisplayId: string;
  periodStart: string;
  periodEnd: string;
  status: string;
  totalAmount: string;
}

export interface ApiRefundRequest {
  id: string;
  refundDisplayId: string;
  purchaseId: string;
  studentId: string;
  amount: string;
  reason: string;
  status: string;
  createdAt: string;
  purchase?: { purchaseDisplayId: string; product: { name: string } };
  student?: { studentDisplayId: string };
}

export interface ApiCommerceDashboard {
  generatedAt: string;
  currency: string;
  todaysOrders: number;
  pendingPayments: number;
  verifiedRevenueToday: number;
  activeSubscriptions: number;
  pastDueSubscriptions: number;
  upgradesToday: number;
  refundsAwaitingReview: number;
  payableCommissions: number;
  checkoutIssues: { expiredUnusedSessions: number };
}

export interface ApiAffiliateMe {
  affiliate: ApiAffiliate;
  referralLink: string;
  stats: { clicks: number; leads: number; orders: number; verifiedPurchases: number };
  commissions: { pending: number; payable: number; paid: number };
}

export const commerceApi = {
  // --- Admin dashboard / reconciliation / analytics -------------------------
  dashboard: () => get<ApiCommerceDashboard>("/api/admin/commerce/dashboard"),
  reconciliation: () => get<{ generatedAt: string; flaggedCount: number; results: { category: string; detail: string; entityType: string; entityId: string }[] }>("/api/admin/commerce/reconciliation"),
  growth: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    const qs = params.toString();
    return get<Record<string, unknown>>(`/api/admin/commerce/growth${qs ? `?${qs}` : ""}`);
  },
  customer360: (studentId: string) => get<Record<string, unknown>>(`/api/admin/students/${studentId}/commerce-360`),

  // --- Refunds ---------------------------------------------------------------
  createRefundRequest: (studentId: string, payload: { purchaseId: string; amount: number; reason: string }) => post<{ refundRequest: ApiRefundRequest }>(`/api/students/${studentId}/refund-requests`, payload),
  refundRequests: (status?: string) => get<{ refundRequests: ApiRefundRequest[] }>(`/api/admin/refund-requests${status ? `?status=${status}` : ""}`),
  reviewRefund: (id: string, decision: "APPROVED" | "REJECTED", reviewNotes?: string) => post<{ refundRequest: ApiRefundRequest }>(`/api/admin/refund-requests/${id}/review`, { decision, reviewNotes }),
  processRefund: (id: string, accessPolicy: "REVOKE_ACCESS" | "RETAIN_ACCESS", providerRefundRef?: string) => post<{ refundRequest: ApiRefundRequest }>(`/api/admin/refund-requests/${id}/process`, { accessPolicy, providerRefundRef }),

  // --- Affiliates --------------------------------------------------------------
  applyAsAffiliate: () => post<{ affiliate: ApiAffiliate }>("/api/affiliates/apply"),
  myAffiliateDashboard: () => get<ApiAffiliateMe>("/api/affiliates/me"),
  adminAffiliates: (status?: string) => get<{ affiliates: (ApiAffiliate & { person: { fullName: string } })[] }>(`/api/admin/affiliates${status ? `?status=${status}` : ""}`),
  setAffiliateStatus: (id: string, status: string, commissionPlanId?: string) => post<{ affiliate: ApiAffiliate }>(`/api/admin/affiliates/${id}/status`, { status, commissionPlanId }),
  affiliateReport: () => get<{ activeAffiliates: number; totalClicks: number; attributedLeads: number; verifiedSales: number; pendingCommissions: number; payableCommissions: number; paidCommissions: number }>("/api/admin/affiliates/report"),

  commissionPlans: () => get<{ plans: ApiCommissionPlan[] }>("/api/admin/commission-plans"),
  createCommissionPlan: (payload: { name: string; type: "PERCENTAGE" | "FIXED_AMOUNT"; rate?: number; fixedAmount?: number }) => post<{ plan: ApiCommissionPlan }>("/api/admin/commission-plans", payload),

  commissions: (status?: string) => get<{ commissions: ApiCommission[] }>(`/api/admin/commissions${status ? `?status=${status}` : ""}`),
  approveCommission: (id: string) => post<{ commission: ApiCommission }>(`/api/admin/commissions/${id}/approve`),
  voidCommission: (id: string, reason: string) => post<{ commission: ApiCommission }>(`/api/admin/commissions/${id}/void`, { reason }),

  payoutBatches: () => get<{ batches: ApiPayoutBatch[] }>("/api/admin/payout-batches"),
  createPayoutBatch: (periodStart: string, periodEnd: string) => post<{ batch: ApiPayoutBatch }>("/api/admin/payout-batches", { periodStart, periodEnd }),
  addCommissionsToBatch: (batchId: string, commissionIds: string[]) => post<{ addedCount: number }>(`/api/admin/payout-batches/${batchId}/add-commissions`, { commissionIds }),
  submitBatchForReview: (batchId: string) => post<{ batch: ApiPayoutBatch }>(`/api/admin/payout-batches/${batchId}/submit-for-review`),
  approveBatch: (batchId: string) => post<{ batch: ApiPayoutBatch }>(`/api/admin/payout-batches/${batchId}/approve`),
  markBatchPaid: (batchId: string, referenceNote: string) => post<{ batch: ApiPayoutBatch }>(`/api/admin/payout-batches/${batchId}/mark-paid`, { referenceNote }),

  // --- Sponsored Access / Scholarship -----------------------------------------
  adminSponsoredAccess: (status?: string) => get<{ sponsoredAccesses: unknown[] }>(`/api/admin/sponsored-access${status ? `?status=${status}` : ""}`),
};
