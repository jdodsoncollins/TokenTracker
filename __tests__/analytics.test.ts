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
    source: 'manual',
    fetchedAt: '2026-07-10T12:00:00.000Z',
  },
};

describe('buildTimeSeries', () => {
  it('buckets cost deltas by day', () => {
    const now = new Date('2026-07-10T18:00:00.000Z');
    const history: UsageHistoryEntry[] = [
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
      {
        providerId: 'p1',
        snapshot: {
          costUsd: 8,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          source: 'manual',
          fetchedAt: '2026-07-09T10:00:00.000Z',
        },
      },
    ];
    const series = buildTimeSeries(history, [provider], 7, now);
    expect(series.points).toHaveLength(7);
    expect(series.hasData).toBe(true);
    expect(series.totalCostDelta).toBeGreaterThan(0);
    // Level should carry to the end at 8
    expect(series.latestCostLevel).toBe(8);
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
    expect(sum.estimatedPortion).toBeGreaterThan(0);
  });
});
