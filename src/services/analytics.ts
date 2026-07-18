import type { ProviderConfig, ProviderKind } from '../types';
import type { UsageHistoryEntry } from './storage';
import { resolveCostUsd } from './pricing';
import { PROVIDER_CATALOG } from './providers/catalog';

export type ChartRange = 7 | 14 | 30;

export interface DayPoint {
  /** YYYY-MM-DD (local) */
  date: string;
  /** Short axis label */
  label: string;
  /** Latest known spend level that day (sum across providers) */
  costLevel: number;
  /** Token level that day */
  tokenLevel: number;
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
  if (s.totalTokens != null) return s.totalTokens;
  if (s.inputTokens != null || s.outputTokens != null) {
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

/**
 * Build daily series from local history.
 * Cost/token *levels* use the last snapshot of each day per provider (summed).
 * *Deltas* measure increases between consecutive snapshots for the same provider.
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
  for (const day of days) {
    levelCost.set(day, 0);
    levelTokens.set(day, 0);
    estShare.set(day, 0);
    deltaCost.set(day, 0);
    deltaTokens.set(day, 0);
  }

  // Levels: for each provider, walk days and carry forward last known values
  for (const [providerId, list] of byProvider) {
    const kind = kindFor(providerId, providers);
    let lastCost = 0;
    let lastEst = 0;
    let lastTok = 0;
    let idx = 0;

    for (const day of days) {
      while (idx < list.length) {
        const when = parseIso(list[idx].snapshot.fetchedAt);
        if (!when) {
          idx += 1;
          continue;
        }
        const key = toLocalDateKey(when);
        if (key > day) break;
        const snap = list[idx].snapshot;
        const resolved = resolveCostUsd({
          kind,
          costUsd: snap.costUsd,
          inputTokens: snap.inputTokens,
          outputTokens: snap.outputTokens,
          totalTokens: snap.totalTokens,
        });
        if (resolved.value != null) {
          lastCost = resolved.value;
          lastEst = resolved.isEstimate ? resolved.value : 0;
        }
        const tok = tokenCount(snap);
        if (tok != null) lastTok = tok;
        idx += 1;
      }
      levelCost.set(day, (levelCost.get(day) ?? 0) + lastCost);
      levelTokens.set(day, (levelTokens.get(day) ?? 0) + lastTok);
      estShare.set(day, (estShare.get(day) ?? 0) + lastEst);
    }
  }

  // Deltas between consecutive snapshots
  for (const [providerId, list] of byProvider) {
    const kind = kindFor(providerId, providers);
    for (let i = 0; i < list.length; i++) {
      const cur = list[i];
      const when = parseIso(cur.snapshot.fetchedAt);
      if (!when) continue;
      const day = toLocalDateKey(when);
      if (!daySet.has(day)) continue;

      const curCost =
        resolveCostUsd({
          kind,
          costUsd: cur.snapshot.costUsd,
          inputTokens: cur.snapshot.inputTokens,
          outputTokens: cur.snapshot.outputTokens,
          totalTokens: cur.snapshot.totalTokens,
        }).value ?? 0;
      const curTok = tokenCount(cur.snapshot) ?? 0;

      if (i === 0) {
        // First observation in history: count as delta if positive
        if (curCost > 0) deltaCost.set(day, (deltaCost.get(day) ?? 0) + curCost);
        if (curTok > 0) deltaTokens.set(day, (deltaTokens.get(day) ?? 0) + curTok);
        continue;
      }

      const prev = list[i - 1];
      const prevCost =
        resolveCostUsd({
          kind,
          costUsd: prev.snapshot.costUsd,
          inputTokens: prev.snapshot.inputTokens,
          outputTokens: prev.snapshot.outputTokens,
          totalTokens: prev.snapshot.totalTokens,
        }).value ?? 0;
      const prevTok = tokenCount(prev.snapshot) ?? 0;

      const dCost = curCost - prevCost;
      const dTok = curTok - prevTok;
      if (dCost > 0) deltaCost.set(day, (deltaCost.get(day) ?? 0) + dCost);
      if (dTok > 0) deltaTokens.set(day, (deltaTokens.get(day) ?? 0) + dTok);
    }
  }

  const points: DayPoint[] = days.map((date) => ({
    date,
    label: shortLabel(date),
    costLevel: levelCost.get(date) ?? 0,
    tokenLevel: levelTokens.get(date) ?? 0,
    costDelta: deltaCost.get(date) ?? 0,
    tokenDelta: deltaTokens.get(date) ?? 0,
    estimatedShare: estShare.get(date) ?? 0,
  }));

  const totalCostDelta = points.reduce((s, p) => s + p.costDelta, 0);
  const totalTokenDelta = points.reduce((s, p) => s + p.tokenDelta, 0);
  const latest = points[points.length - 1];
  const daysWithDelta = points.filter((p) => p.costDelta > 0).length;
  const averageDailyCost =
    daysWithDelta > 0 ? totalCostDelta / range : totalCostDelta > 0 ? totalCostDelta / range : null;
  const projectedMonthlyCost =
    averageDailyCost != null && averageDailyCost > 0
      ? averageDailyCost * 30
      : latest && latest.costLevel > 0
        ? null // level-only data without deltas — don't invent a projection
        : null;

  // Prefer projection from deltas; if no deltas but we have level change start→end
  let projected = projectedMonthlyCost;
  let avgDaily = averageDailyCost;
  if ((avgDaily == null || avgDaily === 0) && points.length >= 2) {
    const first = points.find((p) => p.costLevel > 0);
    const last = [...points].reverse().find((p) => p.costLevel > 0);
    if (first && last && first.date !== last.date) {
      const daySpan = Math.max(
        1,
        Math.round(
          (new Date(last.date).getTime() - new Date(first.date).getTime()) /
            (24 * 60 * 60 * 1000),
        ),
      );
      const rise = last.costLevel - first.costLevel;
      if (rise > 0) {
        avgDaily = rise / daySpan;
        projected = avgDaily * 30;
      }
    }
  }

  const hasData = points.some(
    (p) => p.costLevel > 0 || p.tokenLevel > 0 || p.costDelta > 0 || p.tokenDelta > 0,
  );

  return {
    points,
    range,
    totalCostDelta,
    totalTokenDelta,
    latestCostLevel: latest?.costLevel ?? 0,
    latestTokenLevel: latest?.tokenLevel ?? 0,
    projectedMonthlyCost: projected,
    averageDailyCost: avgDaily,
    hasData,
  };
}

export function buildCostEstimateRows(
  providers: ProviderConfig[],
): CostEstimateRow[] {
  return providers.map((p) => {
    const u = p.lastUsage;
    const reported = u?.costUsd ?? null;
    const resolved = resolveCostUsd({
      kind: p.kind,
      costUsd: u?.costUsd,
      inputTokens: u?.inputTokens,
      outputTokens: u?.outputTokens,
      totalTokens: u?.totalTokens,
    });
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
    };
  });
}

export function sumDisplayCost(rows: CostEstimateRow[]): {
  total: number;
  estimatedPortion: number;
  reportedPortion: number;
} {
  let total = 0;
  let estimatedPortion = 0;
  let reportedPortion = 0;
  for (const r of rows) {
    if (r.displayCost == null) continue;
    total += r.displayCost;
    if (r.isEstimate) estimatedPortion += r.displayCost;
    else reportedPortion += r.displayCost;
  }
  return { total, estimatedPortion, reportedPortion };
}
