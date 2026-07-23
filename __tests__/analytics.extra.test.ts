import { describe, expect, it } from 'vitest';
import {
  buildCostEstimateRows,
  buildTimeSeries,
  sumDisplayCost,
} from '../src/services/analytics';
import type { ProviderConfig } from '../src/types';
import type { UsageHistoryEntry } from '../src/services/storage';

function provider(
  partial: Partial<ProviderConfig> & Pick<ProviderConfig, 'id' | 'kind'>,
): ProviderConfig {
  return {
    label: partial.label ?? partial.kind,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-10T00:00:00.000Z',
    hasCredential: true,
    lastUsage: null,
    lastError: null,
    ...partial,
  };
}

describe('buildTimeSeries multi-provider', () => {
  it('sums cost levels across providers and computes deltas', () => {
    const now = new Date('2026-07-10T18:00:00.000Z');
    const providers = [
      provider({ id: 'a', kind: 'openai', label: 'A' }),
      provider({ id: 'b', kind: 'anthropic', label: 'B' }),
    ];
    const history: UsageHistoryEntry[] = [
      {
        providerId: 'a',
        snapshot: {
          costUsd: 10,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          measurementKind: 'cumulative',
          source: 'api',
          fetchedAt: '2026-07-08T12:00:00.000Z',
        },
      },
      {
        providerId: 'a',
        snapshot: {
          costUsd: 15,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          measurementKind: 'cumulative',
          source: 'api',
          fetchedAt: '2026-07-09T12:00:00.000Z',
        },
      },
      {
        providerId: 'b',
        snapshot: {
          costUsd: 4,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          measurementKind: 'cumulative',
          source: 'manual',
          fetchedAt: '2026-07-09T15:00:00.000Z',
        },
      },
    ];

    const series = buildTimeSeries(history, providers, 7, now);
    expect(series.points).toHaveLength(7);
    expect(series.hasData).toBe(true);
    // Final level = 15 + 4
    expect(series.latestCostLevel).toBe(19);
    // Only A has two observations; first observations are baselines.
    expect(series.totalCostDelta).toBe(5);
    expect(series.averageDailyCost).not.toBeNull();
    expect(series.projectedMonthlyCost).toBeGreaterThan(0);
  });

  it('tracks token deltas and levels from input/output only', () => {
    const now = new Date('2026-07-10T12:00:00.000Z');
    const providers = [provider({ id: 't', kind: 'xai' })];
    const history: UsageHistoryEntry[] = [
      {
        providerId: 't',
        snapshot: {
          costUsd: null,
          inputTokens: 1000,
          outputTokens: 500,
          totalTokens: null,
          modelId: 'grok-3-mini',
          measurementKind: 'cumulative',
          source: 'manual',
          fetchedAt: '2026-07-09T10:00:00.000Z',
        },
      },
      {
        providerId: 't',
        snapshot: {
          costUsd: null,
          inputTokens: 2000,
          outputTokens: 1000,
          totalTokens: null,
          modelId: 'grok-3-mini',
          measurementKind: 'cumulative',
          source: 'manual',
          fetchedAt: '2026-07-10T10:00:00.000Z',
        },
      },
    ];
    const series = buildTimeSeries(history, providers, 7, now);
    expect(series.latestTokenLevel).toBe(3000);
    expect(series.totalTokenDelta).toBeGreaterThan(0);
    // cost estimated from tokens should produce levels
    expect(series.latestCostLevel).toBeGreaterThan(0);
  });

  it('supports 14 and 30 day ranges', () => {
    const now = new Date('2026-07-10T00:00:00.000Z');
    expect(buildTimeSeries([], [], 14, now).points).toHaveLength(14);
    expect(buildTimeSeries([], [], 30, now).points).toHaveLength(30);
  });
});

describe('buildCostEstimateRows / sumDisplayCost', () => {
  it('mixes reported and estimated rows', () => {
    const rows = buildCostEstimateRows([
      provider({
        id: 'r',
        kind: 'openrouter',
        lastUsage: {
          costUsd: 20,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          measurementKind: 'period',
          periodStart: '2026-07-01T00:00:00.000Z',
          periodEnd: '2026-08-01T00:00:00.000Z',
          source: 'api',
          fetchedAt: '2026-07-10T00:00:00.000Z',
        },
      }),
      provider({
        id: 'e',
        kind: 'google',
        lastUsage: {
          costUsd: null,
          inputTokens: 1_000_000,
          outputTokens: 0,
          totalTokens: 1_000_000,
          modelId: 'gemini-2.0-flash',
          measurementKind: 'period',
          periodStart: '2026-07-01T00:00:00.000Z',
          periodEnd: '2026-08-01T00:00:00.000Z',
          source: 'manual',
          fetchedAt: '2026-07-10T00:00:00.000Z',
        },
      }),
      provider({ id: 'empty', kind: 'custom' }),
    ]);

    const reported = rows.find((r) => r.providerId === 'r')!;
    const estimated = rows.find((r) => r.providerId === 'e')!;
    const empty = rows.find((r) => r.providerId === 'empty')!;

    expect(reported.isEstimate).toBe(false);
    expect(reported.displayCost).toBe(20);
    expect(estimated.isEstimate).toBe(true);
    expect(estimated.displayCost).toBeGreaterThan(0);
    expect(empty.displayCost).toBeNull();

    const sum = sumDisplayCost(rows);
    expect(sum.reportedPortion).toBe(20);
    expect(sum.estimatedPortion).toBeGreaterThan(0);
    expect(sum.total).toBe(sum.reportedPortion + sum.estimatedPortion);
    expect(sum.comparable).toBe(true);
  });

  it('refuses to add different periods', () => {
    const rows = buildCostEstimateRows([
      provider({
        id: 'july',
        kind: 'openai',
        lastUsage: {
          costUsd: 10,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          measurementKind: 'period',
          periodStart: '2026-07-01',
          periodEnd: '2026-08-01',
          source: 'api',
          fetchedAt: '2026-07-10T00:00:00.000Z',
        },
      }),
      provider({
        id: 'rolling',
        kind: 'openai',
        lastUsage: {
          costUsd: 20,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          measurementKind: 'period',
          periodStart: '2026-06-10',
          periodEnd: '2026-07-10',
          source: 'api',
          fetchedAt: '2026-07-10T00:00:00.000Z',
        },
      }),
    ]);

    expect(sumDisplayCost(rows)).toMatchObject({ total: null, comparable: false });
  });
});
