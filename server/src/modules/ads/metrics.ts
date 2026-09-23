// Formula safety + honest-unknown aggregation (spec sections 24-26, 100).
// A field is null (UNKNOWN/UNAVAILABLE) when no snapshot in range reported
// it — never silently treated as zero, and a ratio is only ever computed
// when both its numerator and denominator are real, present, non-zero
// values (spec section 25) — never a divide-by-zero, never an AI-invented
// fill-in for a missing metric (spec section 26).

export interface SnapshotLike {
  spend: unknown;
  impressions: unknown;
  reach: unknown;
  clicks: unknown;
  linkClicks: unknown;
  leads: unknown;
  messages: unknown;
  purchases: unknown;
  purchaseValue: unknown;
}

export interface AggregatedMetrics {
  spend: number | null;
  impressions: number | null;
  reach: number | null;
  clicks: number | null;
  linkClicks: number | null;
  leads: number | null;
  messages: number | null;
  purchases: number | null;
  purchaseValue: number | null; // PLATFORM-REPORTED purchase value (spec section 48) — never confused with M.A.I.A. Verified Revenue
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "object" && v !== null && "toNumber" in v ? (v as { toNumber: () => number }).toNumber() : Number(v);
  return Number.isFinite(n) ? n : null;
}

function sumField(rows: SnapshotLike[], field: keyof SnapshotLike): number | null {
  let sum = 0;
  let sawAny = false;
  for (const row of rows) {
    const n = toNumber(row[field]);
    if (n !== null) {
      sum += n;
      sawAny = true;
    }
  }
  return sawAny ? sum : null;
}

export function aggregateSnapshots(rows: SnapshotLike[]): AggregatedMetrics {
  return {
    spend: sumField(rows, "spend"),
    impressions: sumField(rows, "impressions"),
    reach: sumField(rows, "reach"),
    clicks: sumField(rows, "clicks"),
    linkClicks: sumField(rows, "linkClicks"),
    leads: sumField(rows, "leads"),
    messages: sumField(rows, "messages"),
    purchases: sumField(rows, "purchases"),
    purchaseValue: sumField(rows, "purchaseValue"),
  };
}

function safeDivide(numerator: number | null, denominator: number | null): number | null {
  if (numerator === null || denominator === null || denominator === 0) return null;
  return numerator / denominator;
}

export interface DerivedMetrics {
  cpl: number | null;
  cpc: number | null;
  ctr: number | null; // fraction, e.g. 0.02 = 2%
  cpm: number | null;
  platformReportedRoas: number | null;
}

export function deriveMetrics(agg: AggregatedMetrics): DerivedMetrics {
  return {
    cpl: safeDivide(agg.spend, agg.leads),
    cpc: safeDivide(agg.spend, agg.clicks),
    ctr: safeDivide(agg.clicks, agg.impressions),
    cpm: agg.spend !== null && agg.impressions !== null && agg.impressions > 0 ? (agg.spend / agg.impressions) * 1000 : null,
    platformReportedRoas: safeDivide(agg.purchaseValue, agg.spend),
  };
}
