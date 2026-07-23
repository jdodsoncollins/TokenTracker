import { describe, expect, it } from 'vitest';
import { restoreLatestUsage } from '../src/services/usageSnapshots';
import type { ProviderConfig, UsageSnapshot } from '../src/types';

const provider: ProviderConfig = {
  id: 'p1',
  kind: 'openai',
  label: 'OpenAI',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-23T00:00:00.000Z',
  hasCredential: true,
  lastUsage: {
    costUsd: null,
    inputTokens: null,
    outputTokens: null,
    totalTokens: null,
    measurementKind: 'point',
    source: 'api',
    fetchedAt: '2026-07-23T00:00:00.000Z',
  },
  lastError: null,
};

const manual: UsageSnapshot = {
  costUsd: 68.46,
  inputTokens: 132_263_627,
  outputTokens: 0,
  totalTokens: 132_263_627,
  measurementKind: 'point',
  source: 'manual',
  fetchedAt: '2026-07-22T00:00:00.000Z',
};

describe('restoreLatestUsage', () => {
  it('restores a manual reading hidden by a later validation snapshot', () => {
    const restored = restoreLatestUsage(
      [provider],
      [
        { providerId: 'p1', snapshot: provider.lastUsage! },
        { providerId: 'p1', snapshot: manual },
      ],
    );

    expect(restored[0].lastUsage).toEqual(manual);
  });
});
