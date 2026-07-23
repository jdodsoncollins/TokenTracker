import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => store.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    multiRemove: vi.fn(async (keys: string[]) => {
      for (const k of keys) store.delete(k);
    }),
  },
}));

import {
  appendUsageHistory,
  clearAllLocalData,
  loadProviders,
  loadUsageHistory,
  mergeUsageHistory,
  removeHistoryForProvider,
  saveProviders,
} from '../src/services/storage';
import type { ProviderConfig } from '../src/types';

const sampleProvider: ProviderConfig = {
  id: 'p1',
  kind: 'openai',
  label: 'OpenAI',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  hasCredential: true,
  lastUsage: null,
  lastError: null,
};

describe('storage', () => {
  beforeEach(() => {
    store.clear();
  });

  it('saves and loads providers without apiKey fields', async () => {
    await saveProviders([
      { ...sampleProvider, ...( { apiKey: 'sk-secret' } as object) },
    ] as ProviderConfig[]);
    const loaded = await loadProviders();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].id).toBe('p1');
    expect('apiKey' in loaded[0]).toBe(false);
    const raw = store.get('tt_providers_v1')!;
    expect(raw).not.toContain('sk-secret');
  });

  it('surfaces corrupt provider JSON', async () => {
    store.set('tt_providers_v1', '{not-json');
    await expect(loadProviders()).rejects.toThrow('provider data is corrupted');
  });

  it('surfaces corrupt usage history', async () => {
    store.set('tt_usage_history_v1', JSON.stringify([{ providerId: 'p1' }]));
    await expect(loadUsageHistory()).rejects.toThrow(
      'usage history data is corrupted',
    );
  });

  it('sorts newest-first before retaining the latest 2,000 entries', async () => {
    const entries = Array.from({ length: 2_005 }, (_, i) => ({
      providerId: `p${i % 23}`,
      snapshot: {
        costUsd: i,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        source: 'manual' as const,
        fetchedAt: new Date(2026, 0, 1 + i).toISOString(),
      },
    }));
    await mergeUsageHistory(entries.reverse());
    const hist = await loadUsageHistory();
    expect(hist.length).toBe(2_000);
    expect(hist[0].snapshot.costUsd).toBe(2_004);
    expect(hist.at(-1)?.snapshot.costUsd).toBe(5);
  });

  it('serializes concurrent usage history writes', async () => {
    const entry = (providerId: string) => ({
      providerId,
      snapshot: {
        costUsd: 1,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        source: 'manual' as const,
        fetchedAt: '2026-07-01T00:00:00.000Z',
      },
    });
    await Promise.all([
      appendUsageHistory(entry('p1')),
      appendUsageHistory(entry('p2')),
    ]);
    expect((await loadUsageHistory()).map((item) => item.providerId).sort()).toEqual([
      'p1',
      'p2',
    ]);
  });

  it('replaces refreshed API periods while preserving manual entries', async () => {
    const period = {
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      measurementKind: 'period' as const,
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-07-02T00:00:00.000Z',
      source: 'api' as const,
    };
    await mergeUsageHistory([
      {
        providerId: 'p1',
        snapshot: { ...period, costUsd: 1, fetchedAt: '2026-07-02T01:00:00.000Z' },
      },
      {
        providerId: 'p1',
        snapshot: {
          costUsd: 9,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          source: 'manual',
          fetchedAt: '2026-07-02T01:00:00.000Z',
        },
      },
    ]);

    const merged = await mergeUsageHistory([
      {
        providerId: 'p1',
        snapshot: { ...period, costUsd: 2, fetchedAt: '2026-07-03T01:00:00.000Z' },
      },
    ]);

    expect(merged).toHaveLength(2);
    expect(merged.find((entry) => entry.snapshot.source === 'api')?.snapshot.costUsd).toBe(
      2,
    );
    expect(merged.some((entry) => entry.snapshot.source === 'manual')).toBe(true);
  });

  it('preserves omitted period metrics, accepts zero, and recomputes total tokens', async () => {
    const period = {
      measurementKind: 'period' as const,
      periodStart: '2026-07-01T00:00:00.000Z',
      periodEnd: '2026-07-02T00:00:00.000Z',
      source: 'api' as const,
    };
    await mergeUsageHistory([
      {
        providerId: 'p1',
        snapshot: {
          ...period,
          costUsd: 3,
          inputTokens: 10,
          outputTokens: 4,
          totalTokens: 14,
          fetchedAt: '2026-07-01T00:00:00.000Z',
        },
      },
    ]);

    const [refreshed] = await mergeUsageHistory([
      {
        providerId: 'p1',
        snapshot: {
          ...period,
          costUsd: 0,
          inputTokens: null,
          outputTokens: 0,
          totalTokens: null,
          fetchedAt: '2026-07-01T12:00:00.000Z',
        },
      },
    ]);

    expect(refreshed.snapshot).toMatchObject({
      costUsd: 0,
      inputTokens: 10,
      outputTokens: 0,
      totalTokens: 10,
      fetchedAt: '2026-07-01T12:00:00.000Z',
    });
  });

  it('removes history for a provider', async () => {
    await appendUsageHistory({
      providerId: 'p1',
      snapshot: {
        costUsd: 1,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        source: 'manual',
        fetchedAt: '2026-07-01T00:00:00.000Z',
      },
    });
    await appendUsageHistory({
      providerId: 'p2',
      snapshot: {
        costUsd: 2,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        source: 'manual',
        fetchedAt: '2026-07-02T00:00:00.000Z',
      },
    });
    await removeHistoryForProvider('p1');
    const hist = await loadUsageHistory();
    expect(hist).toHaveLength(1);
    expect(hist[0].providerId).toBe('p2');
  });

  it('clears all local data', async () => {
    await saveProviders([sampleProvider]);
    await appendUsageHistory({
      providerId: 'p1',
      snapshot: {
        costUsd: 1,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        source: 'manual',
        fetchedAt: '2026-07-01T00:00:00.000Z',
      },
    });
    await clearAllLocalData();
    expect(await loadProviders()).toEqual([]);
    expect(await loadUsageHistory()).toEqual([]);
  });

  it('strips apiKey when loading legacy records', async () => {
    store.set(
      'tt_providers_v1',
      JSON.stringify([{ ...sampleProvider, apiKey: 'leak' }]),
    );
    const loaded = await loadProviders();
    expect(loaded[0]).not.toHaveProperty('apiKey');
  });
});
