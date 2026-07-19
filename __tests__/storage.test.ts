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

  it('returns empty array for corrupt provider JSON', async () => {
    store.set('tt_providers_v1', '{not-json');
    expect(await loadProviders()).toEqual([]);
  });

  it('appends usage history and caps at 500', async () => {
    for (let i = 0; i < 505; i++) {
      // eslint-disable-next-line no-await-in-loop
      await appendUsageHistory({
        providerId: 'p1',
        snapshot: {
          costUsd: i,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          source: 'manual',
          fetchedAt: new Date(2026, 0, 1 + (i % 28)).toISOString(),
        },
      });
    }
    const hist = await loadUsageHistory();
    expect(hist.length).toBe(500);
    // newest first
    expect(hist[0].snapshot.costUsd).toBe(504);
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
