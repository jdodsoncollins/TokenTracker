import { describe, expect, it } from 'vitest';
import { createManualSnapshot } from '../src/services/providers/fetchUsage';
import { validateManualUsageInput } from '../src/services/pricing';

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

describe('manual usage validation', () => {
  it('requires at least one metric', () => {
    expect(
      validateManualUsageInput({
        costUsd: '',
        inputTokens: '',
        outputTokens: '',
        modelId: '',
      }).error,
    ).toMatch(/cost or at least one token/i);
  });

  it('rejects invalid costs and token counts', () => {
    expect(
      validateManualUsageInput({
        costUsd: '-1',
        inputTokens: '',
        outputTokens: '',
        modelId: '',
      }).error,
    ).toMatch(/cost/i);
    expect(
      validateManualUsageInput({
        costUsd: '',
        inputTokens: '1.5',
        outputTokens: '',
        modelId: 'gpt-4o-mini',
      }).error,
    ).toMatch(/whole numbers/i);
  });

  it('requires an explicit model only when tokens need estimation', () => {
    expect(
      validateManualUsageInput({
        costUsd: '',
        inputTokens: '100',
        outputTokens: '50',
        modelId: '',
      }).error,
    ).toMatch(/pricing model/i);
    expect(
      validateManualUsageInput({
        costUsd: '2',
        inputTokens: '100',
        outputTokens: '50',
        modelId: '',
      }).value,
    ).toMatchObject({ costUsd: 2, inputTokens: 100, outputTokens: 50 });
  });
});
