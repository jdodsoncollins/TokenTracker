import type { ProviderConfig, ProviderKind, UsageSnapshot } from '../types';
import type { UsageHistoryEntry } from './storage';
import { resolveCostUsd } from './pricing';
import { PROVIDER_CATALOG } from './providers/catalog';
import { hasUsageMetrics } from './usageSnapshots';

export type ChartRange = 7 | 14 | 30;

export interface DayPoint {
  /** YYYY-MM-DD (local) */
  date: string;
  /** Short axis label */
  label: string;
  /** Latest compatible reading that day; only cumulative values carry forward. */
  costLevel: number | null;
  /** Token level that day */
  tokenLevel: number | null;
  /** Positive cost deltas observed that day (better for cumulative APIs) */
  costDelta: number;
  /** Positive token deltas that day */
  tokenDelta: number;
  /** Cost that is estimated (not provider-reported) within level */
  estimatedShare: number;
}

export interface SeriesSummary {
  points: DayPoint[];
  range: ChartRange;
  totalCostDelta: number;
  totalTokenDelta: number;
  latestCostLevel: number;
  latestTokenLevel: number;
  /** Simple linear projection of next 30 days from average daily delta */
  projectedMonthlyCost: number | null;
  averageDailyCost: number | null;
  hasData: boolean;
}

export interface CostEstimateRow {
  providerId: string;
  label: string;
  kind: ProviderKind;
  color: string;
  reportedCost: number | null;
  estimatedCost: number | null;
  /** Best available: reported, else estimated */
  displayCost: number | null;
  isEstimate: boolean;
  estimateModel?: string;
  tokens: number | null;
  measurementKind: UsageSnapshot['measurementKind'] | 'unknown';
  periodStart?: string;
  periodEnd?: string;
  /** Equal non-null keys identify readings that can be added truthfully. */
  comparabilityKey: string | null;
}

function toLocalDateKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIso(iso: string): Date | null {
  const t = new Date(iso);
  return Number.isNaN(t.getTime()) ? null : t;
}

function shortLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function tokenCount(s: {
  totalTokens?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): number | null {
  const valid = (value: number | null | undefined) =>
    value != null &&
    Number.isFinite(value) &&
    value >= 0 &&
    Number.isInteger(value);
  if (s.totalTokens != null) {
    return valid(s.totalTokens) ? s.totalTokens : null;
  }
  if (s.inputTokens != null || s.outputTokens != null) {
    if (
      (s.inputTokens != null && !valid(s.inputTokens)) ||
      (s.outputTokens != null && !valid(s.outputTokens))
    ) {
      return null;
    }
    return (s.inputTokens ?? 0) + (s.outputTokens ?? 0);
  }
  return null;
}

function kindFor(
  providerId: string,
  providers: ProviderConfig[],
): ProviderKind {
  return providers.find((p) => p.id === providerId)?.kind ?? 'custom';
}

function resolvedCost(kind: ProviderKind, snapshot: UsageSnapshot) {
  return resolveCostUsd({
    kind,
    costUsd: snapshot.costUsd,
    inputTokens: snapshot.inputTokens,
    outputTokens: snapshot.outputTokens,
    totalTokens: snapshot.totalTokens,
    modelId: snapshot.modelId,
  });
}

function sameCumulativeSeries(a: UsageSnapshot, b: UsageSnapshot): boolean {
  return (
    a.measurementKind === 'cumulative' &&
    b.measurementKind === 'cumulative' &&
    (a.periodStart ?? null) === (b.periodStart ?? null)
  );
}

function comparableCostValues(a: UsageSnapshot, b: UsageSnapshot): boolean {
  const aReported = a.costUsd != null;
  const bReported = b.costUsd != null;
  return (
    (aReported && bReported) ||
    (!aReported && !bReported && Boolean(a.modelId) && a.modelId === b.modelId)
  );
}

function comparabilityKey(snapshot: UsageSnapshot): string | null {
  if (snapshot.measurementKind === 'cumulative') {
    return `cumulative:${snapshot.periodStart ?? 'lifetime'}`;
  }
  if (
    snapshot.measurementKind === 'period' &&
    snapshot.periodStart &&
    snapshot.periodEnd
  ) {
    return `period:${snapshot.periodStart}:${snapshot.periodEnd}`;
  }
  return null;
}

/**
 * Build daily series from local history.
 * Cumulative levels carry forward. Period, point, and legacy unknown readings only
 * appear on the day observed. Deltas require two compatible cumulative snapshots.
 */
export function buildTimeSeries(
  history: UsageHistoryEntry[],
  providers: ProviderConfig[],
  range: ChartRange = 14,
  now: Date = new Date(),
): SeriesSummary {
  const days: string[] = [];
  for (let i = range - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push(toLocalDateKey(d));
  }
  const daySet = new Set(days);

  // Chronological snapshots per provider
  const byProvider = new Map<string, UsageHistoryEntry[]>();
  for (const entry of history) {
    const list = byProvider.get(entry.providerId) ?? [];
    list.push(entry);
    byProvider.set(entry.providerId, list);
  }
  for (const list of byProvider.values()) {
    list.sort(
      (a, b) =>
        new Date(a.snapshot.fetchedAt).getTime() -
        new Date(b.snapshot.fetchedAt).getTime(),
    );
  }

  // Per-day aggregates
  const levelCost = new Map<string, number>();
  const levelTokens = new Map<string, number>();
  const estShare = new Map<string, number>();
  const deltaCost = new Map<string, number>();
  const deltaTokens = new Map<string, number>();
  const costReadingKeys = new Map<string, Array<string | null>>();
  const tokenReadingKeys = new Map<string, Array<string | null>>();
  for (const day of days) {
    levelCost.set(day, 0);
    levelTokens.set(day, 0);
    estShare.set(day, 0);
    deltaCost.set(day, 0);
    deltaTokens.set(day, 0);
    costReadingKeys.set(day, []);
    tokenReadingKeys.set(day, []);
  }

  // Levels: only explicitly cumulative readings survive beyond their observation day.
  for (const [providerId, list] of byProvider) {
    const kind = kindFor(providerId, providers);
    let cumulative: UsageSnapshot | null = null;
    let idx = 0;

    for (const day of days) {
      let observedToday: UsageSnapshot | null = null;
      while (idx < list.length) {
        const when = parseIso(list[idx].snapshot.fetchedAt);
        if (!when) {
          idx += 1;
          continue;
        }
        const key = toLocalDateKey(when);
        if (key > day) break;
        const snap = list[idx].snapshot;
        if (key === day && hasUsageMetrics(snap)) observedToday = snap;
        if (snap.measurementKind === 'cumulative' && hasUsageMetrics(snap)) {
          cumulative = snap;
        }
        idx += 1;
      }
      const reading = observedToday ?? cumulative;
      if (!reading) continue;
      const resolved = resolvedCost(kind, reading);
      const tok = tokenCount(reading);
      if (resolved.value != null) {
        levelCost.set(day, (levelCost.get(day) ?? 0) + resolved.value);
        costReadingKeys.get(day)?.push(comparabilityKey(reading));
        if (resolved.isEstimate) {
          estShare.set(day, (estShare.get(day) ?? 0) + resolved.value);
        }
      }
      if (tok != null) {
        levelTokens.set(day, (levelTokens.get(day) ?? 0) + tok);
        tokenReadingKeys.get(day)?.push(comparabilityKey(reading));
      }
    }
  }

  // Deltas between compatible cumulative snapshots only.
  for (const [providerId, list] of byProvider) {
    const kind = kindFor(providerId, providers);
    let previousCumulative: UsageSnapshot | null = null;
    for (const cur of list) {
      const when = parseIso(cur.snapshot.fetchedAt);
      if (
        !when ||
        cur.snapshot.measurementKind !== 'cumulative' ||
        !hasUsageMetrics(cur.snapshot)
      ) {
        continue;
      }
      if (!previousCumulative || !sameCumulativeSeries(previousCumulative, cur.snapshot)) {
        previousCumulative = cur.snapshot;
        continue;
      }

      const day = toLocalDateKey(when);
      if (daySet.has(day)) {
        const curCost = resolvedCost(kind, cur.snapshot).value;
        const prevCost = resolvedCost(kind, previousCumulative).value;
        if (
          curCost != null &&
          prevCost != null &&
          comparableCostValues(previousCumulative, cur.snapshot) &&
          curCost > prevCost
        ) {
          deltaCost.set(day, (deltaCost.get(day) ?? 0) + curCost - prevCost);
        }

        const curTok = tokenCount(cur.snapshot);
        const prevTok = tokenCount(previousCumulative);
        if (curTok != null && prevTok != null && curTok > prevTok) {
          deltaTokens.set(day, (deltaTokens.get(day) ?? 0) + curTok - prevTok);
        }
      }
      previousCumulative = cur.snapshot;
    }
  }

  const canCombine = (keys: Array<string | null>) =>
    keys.length <= 1 ||
    (keys[0] != null && keys.every((key) => key === keys[0]));
  const points: DayPoint[] = days.map((date) => {
    const combineCost = canCombine(costReadingKeys.get(date) ?? []);
    const combineTokens = canCombine(tokenReadingKeys.get(date) ?? []);
    return {
      date,
      label: shortLabel(date),
      costLevel: combineCost ? (levelCost.get(date) ?? 0) : null,
      tokenLevel: combineTokens ? (levelTokens.get(date) ?? 0) : null,
      costDelta: deltaCost.get(date) ?? 0,
      tokenDelta: deltaTokens.get(date) ?? 0,
      estimatedShare: combineCost ? (estShare.get(date) ?? 0) : 0,
    };
  });

  const totalCostDelta = points.reduce((s, p) => s + p.costDelta, 0);
  const totalTokenDelta = points.reduce((s, p) => s + p.tokenDelta, 0);
  const latest = points[points.length - 1];
  const averageDailyCost =
    totalCostDelta > 0 ? totalCostDelta / range : null;
  const projectedMonthlyCost =
    averageDailyCost != null && averageDailyCost > 0
      ? averageDailyCost * 30
      : null;

  const hasData = points.some(
    (p) =>
      (p.costLevel ?? 0) > 0 ||
      (p.tokenLevel ?? 0) > 0 ||
      p.costDelta > 0 ||
      p.tokenDelta > 0,
  );

  return {
    points,
    range,
    totalCostDelta,
    totalTokenDelta,
    latestCostLevel: latest?.costLevel ?? 0,
    latestTokenLevel: latest?.tokenLevel ?? 0,
    projectedMonthlyCost,
    averageDailyCost,
    hasData,
  };
}

export function buildCostEstimateRows(
  providers: ProviderConfig[],
): CostEstimateRow[] {
  return providers.map((p) => {
    const u = p.lastUsage;
    const reported = u?.costUsd ?? null;
    const resolved = u
      ? resolvedCost(p.kind, u)
      : { value: null, isEstimate: false, modelLabel: undefined };
    const tokens = u ? tokenCount(u) : null;
    return {
      providerId: p.id,
      label: p.label,
      kind: p.kind,
      color: PROVIDER_CATALOG[p.kind].color,
      reportedCost: reported,
      estimatedCost: resolved.isEstimate ? resolved.value : null,
      displayCost: resolved.value,
      isEstimate: resolved.isEstimate,
      estimateModel: resolved.modelLabel,
      tokens,
      measurementKind: u?.measurementKind ?? 'unknown',
      periodStart: u?.periodStart,
      periodEnd: u?.periodEnd,
      comparabilityKey: u ? comparabilityKey(u) : null,
    };
  });
}

export function sumDisplayCost(rows: CostEstimateRow[]): {
  total: number | null;
  estimatedPortion: number;
  reportedPortion: number;
  comparable: boolean;
} {
  const active = rows.filter((row) => row.displayCost != null);
  const key = active[0]?.comparabilityKey ?? null;
  const comparable =
    active.length === 1 ||
    (active.length > 1 &&
      key != null &&
      active.every((row) => row.comparabilityKey === key));
  if (!comparable) {
    return {
      total: null,
      estimatedPortion: 0,
      reportedPortion: 0,
      comparable: false,
    };
  }

  let total = 0;
  let estimatedPortion = 0;
  let reportedPortion = 0;
  for (const r of active) {
    if (r.displayCost == null) continue;
    total += r.displayCost;
    if (r.isEstimate) estimatedPortion += r.displayCost;
    else reportedPortion += r.displayCost;
  }
  return { total, estimatedPortion, reportedPortion, comparable: true };
}
