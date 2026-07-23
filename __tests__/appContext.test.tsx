import React, { type ReactNode } from 'react';
import { act, create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ProviderConfig } from '../src/types';

(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean })
  .IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  saveProviders: vi.fn(),
  appendUsageHistory: vi.fn(),
  fetchProviderUsage: vi.fn(),
}));

const initialProviders: ProviderConfig[] = [
  {
    id: 'openai-id',
    kind: 'openai',
    label: 'OpenAI',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    hasCredential: true,
    lastUsage: null,
    lastError: null,
  },
  {
    id: 'xai-id',
    kind: 'xai',
    label: 'xAI',
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    hasCredential: true,
    lastUsage: null,
    lastError: null,
  },
];

vi.mock('../src/services/storage', () => ({
  loadProviders: vi.fn(async () => initialProviders),
  loadUsageHistory: vi.fn(async () => []),
  saveProviders: mocks.saveProviders,
  appendUsageHistory: mocks.appendUsageHistory,
  removeHistoryForProvider: vi.fn(),
  clearAllLocalData: vi.fn(),
}));

vi.mock('../src/services/secureCredentials', () => ({
  getCredential: vi.fn(async (id: string) => `key-${id}`),
  saveCredential: vi.fn(),
  deleteCredential: vi.fn(),
  migrateCredentialStorage: vi.fn(),
  wipeAllCredentials: vi.fn(),
}));

vi.mock('../src/services/providers/fetchUsage', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../src/services/providers/fetchUsage')>();
  return { ...original, fetchProviderUsage: mocks.fetchProviderUsage };
});

import { AppProvider, useApp } from '../src/app/AppContext';

type AppContextValue = ReturnType<typeof useApp>;
let current: AppContextValue | null = null;

function CaptureContext(): ReactNode {
  current = useApp();
  return null;
}

describe('AppProvider', () => {
  beforeEach(() => {
    current = null;
    vi.clearAllMocks();
    mocks.fetchProviderUsage.mockImplementation(async (kind: string) => ({
      ok: true,
      snapshot: {
        costUsd: kind === 'openai' ? 1 : 2,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        measurementKind: 'point',
        source: 'api',
        fetchedAt: '2026-07-23T00:00:00.000Z',
      },
    }));
  });

  it('retains every provider update from refresh all', async () => {
    await act(async () => {
      create(
        <AppProvider>
          <CaptureContext />
        </AppProvider>,
      );
    });

    expect(current?.ready).toBe(true);
    await act(async () => {
      await current?.refreshAll();
    });

    expect(current?.providers.map((provider) => provider.lastUsage?.costUsd)).toEqual([
      1,
      2,
    ]);
    expect(mocks.saveProviders).toHaveBeenLastCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ id: 'openai-id', lastUsage: expect.any(Object) }),
        expect.objectContaining({ id: 'xai-id', lastUsage: expect.any(Object) }),
      ]),
    );
  });
});
