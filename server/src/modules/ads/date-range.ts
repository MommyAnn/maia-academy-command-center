// Date range resolution (spec sections 21-22) — every named preset resolves
// against the CALLER-supplied timezone offset (minutes, matching
// Date.getTimezoneOffset() sign convention: minutes to ADD to UTC to reach
// local time is -offsetMinutes) so account/business reporting boundaries
// are never silently mixed with server-local time.

export const DATE_RANGE_PRESETS = ["TODAY", "YESTERDAY", "LAST_7_DAYS", "LAST_14_DAYS", "LAST_30_DAYS", "THIS_MONTH", "PREVIOUS_MONTH", "CUSTOM"] as const;
export type DateRangePreset = (typeof DATE_RANGE_PRESETS)[number];

export interface ResolvedDateRange {
  from: Date;
  to: Date;
}

function startOfDayUtc(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

export function resolveDateRange(preset: DateRangePreset, opts: { from?: string; to?: string; timezoneOffsetMinutes?: number } = {}): ResolvedDateRange {
  const offsetMs = (opts.timezoneOffsetMinutes ?? 0) * 60_000;
  const nowLocal = new Date(Date.now() + offsetMs);
  const todayLocal = startOfDayUtc(nowLocal);

  switch (preset) {
    case "TODAY":
      return { from: todayLocal, to: todayLocal };
    case "YESTERDAY": {
      const y = new Date(todayLocal);
      y.setUTCDate(y.getUTCDate() - 1);
      return { from: y, to: y };
    }
    case "LAST_7_DAYS": {
      const from = new Date(todayLocal);
      from.setUTCDate(from.getUTCDate() - 6);
      return { from, to: todayLocal };
    }
    case "LAST_14_DAYS": {
      const from = new Date(todayLocal);
      from.setUTCDate(from.getUTCDate() - 13);
      return { from, to: todayLocal };
    }
    case "LAST_30_DAYS": {
      const from = new Date(todayLocal);
      from.setUTCDate(from.getUTCDate() - 29);
      return { from, to: todayLocal };
    }
    case "THIS_MONTH": {
      const from = new Date(Date.UTC(todayLocal.getUTCFullYear(), todayLocal.getUTCMonth(), 1));
      return { from, to: todayLocal };
    }
    case "PREVIOUS_MONTH": {
      const from = new Date(Date.UTC(todayLocal.getUTCFullYear(), todayLocal.getUTCMonth() - 1, 1));
      const to = new Date(Date.UTC(todayLocal.getUTCFullYear(), todayLocal.getUTCMonth(), 0));
      return { from, to };
    }
    case "CUSTOM": {
      if (!opts.from || !opts.to) throw new Error("CUSTOM date range requires both 'from' and 'to'.");
      return { from: startOfDayUtc(new Date(opts.from)), to: startOfDayUtc(new Date(opts.to)) };
    }
  }
}
