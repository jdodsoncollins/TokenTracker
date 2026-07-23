import { describe, expect, it } from 'vitest';
import {
  buildCostEstimateRows,
  buildTimeSeries,
  sumDisplayCost,
} from '../src/services/analytics';
import type { ProviderConfig } from '../src/types';
import type { UsageHistoryEntry } from '../src/services/storage';

const provider: ProviderConfig = {
  id: 'p1',
  kind: 'openai',
  label: 'OpenAI',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-10T00:00:00.000Z',
  hasCredential: true,
  lastUsage: {
    costUsd: null,
    inputTokens: 1_000_000,
    outputTokens: 500_000,
    totalTokens: 1_500_000,
    modelId: 'gpt-4o-mini',
    measurementKind: 'point',
    source: 'manual',
    fetchedAt: '2026-07-10T12:00:00.000Z',
  },
};

describe('buildTimeSeries', () => {
  it('buckets compatible cumulative cost deltas by day', () => {
    const now = new Date('2026-07-10T18:00:00.000Z');
    const history: UsageHistoryEntry[] = [
      {
        providerId: 'p1',
        snapshot: {
          costUsd: 5,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          measurementKind: 'cumulative',
          source: 'manual',
          fetchedAt: '2026-07-08T10:00:00.000Z',
        },
      },
      {
        providerId: 'p1',
        snapshot: {
          costUsd: 8,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          measurementKind: 'cumulative',
          source: 'manual',
          fetchedAt: '2026-07-09T10:00:00.000Z',
        },
      },
    ];
    const series = buildTimeSeries(history, [provider], 7, now);
    expect(series.points).toHaveLength(7);
    expect(series.hasData).toBe(true);
    expect(series.totalCostDelta).toBe(3);
    // Level should carry to the end at 8
    expect(series.latestCostLevel).toBe(8);
  });

  it('does not carry or delta legacy unknown readings', () => {
    const series = buildTimeSeries(
      [
        {
          providerId: 'p1',
          snapshot: {
            costUsd: 5,
            inputTokens: null,
            outputTokens: null,
            totalTokens: null,
            source: 'manual',
            fetchedAt: '2026-07-08T10:00:00.000Z',
          },
        },
      ],
      [provider],
      7,
      new Date('2026-07-10T18:00:00.000Z'),
    );
    expect(series.totalCostDelta).toBe(0);
    expect(series.latestCostLevel).toBe(0);
    expect(series.projectedMonthlyCost).toBeNull();
  });

  it('does not carry, delta, or project point and period readings', () => {
    const snapshots = [
      { costUsd: 4, measurementKind: 'period' as const, fetchedAt: '2026-07-08T10:00:00.000Z' },
      { costUsd: 7, measurementKind: 'point' as const, fetchedAt: '2026-07-09T10:00:00.000Z' },
    ];
    const series = buildTimeSeries(
      snapshots.map((snapshot) => ({
        providerId: 'p1',
        snapshot: {
          ...snapshot,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          source: 'manual' as const,
        },
      })),
      [provider],
      7,
      new Date('2026-07-10T18:00:00.000Z'),
    );

    expect(series.totalCostDelta).toBe(0);
    expect(series.latestCostLevel).toBe(0);
    expect(series.projectedMonthlyCost).toBeNull();
  });

  it('returns empty-ish series without history', () => {
    const series = buildTimeSeries([], [], 7, new Date('2026-07-10T00:00:00Z'));
    expect(series.hasData).toBe(false);
    expect(series.points).toHaveLength(7);
  });
});

describe('cost estimates', () => {
  it('estimates when only tokens present', () => {
    const rows = buildCostEstimateRows([provider]);
    expect(rows[0].isEstimate).toBe(true);
    expect(rows[0].displayCost).toBeGreaterThan(0);
    const sum = sumDisplayCost(rows);
    expect(sum.total).toBeNull();
    expect(sum.comparable).toBe(false);
  });
});
