import { describe, expect, it } from 'vitest';
import { createManualSnapshot } from '../src/services/providers/fetchUsage';

describe('createManualSnapshot', () => {
  it('marks source as manual and sums tokens', () => {
    const snap = createManualSnapshot({
      costUsd: 3.5,
      inputTokens: 100,
      outputTokens: 50,
      note: 'test',
    });
    expect(snap.source).toBe('manual');
    expect(snap.costUsd).toBe(3.5);
    expect(snap.totalTokens).toBe(150);
    expect(snap.note).toBe('test');
    expect(snap.fetchedAt).toBeTruthy();
  });
});
