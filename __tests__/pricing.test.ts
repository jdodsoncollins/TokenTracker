import { describe, expect, it } from 'vitest';
import {
  estimateCostFromTokens,
  resolveCostUsd,
} from '../src/services/pricing';

describe('estimateCostFromTokens', () => {
  it('prices input and output separately', () => {
    // gpt-4o-mini: 0.15 / 0.60 per 1M
    const est = estimateCostFromTokens({
      kind: 'openai',
      inputTokens: 1_000_000,
      outputTokens: 1_000_000,
      modelId: 'gpt-4o-mini',
    });
    expect(est.costUsd).toBeCloseTo(0.75, 5);
    expect(est.assumedSplit).toBe(false);
  });

  it('assumes split when only total tokens given', () => {
    const est = estimateCostFromTokens({
      kind: 'openai',
      totalTokens: 1_000_000,
      modelId: 'gpt-4o-mini',
    });
    expect(est.assumedSplit).toBe(true);
    expect(est.costUsd).toBeGreaterThan(0);
  });
});

describe('resolveCostUsd', () => {
  it('prefers reported cost over estimate', () => {
    const r = resolveCostUsd({
      kind: 'openai',
      costUsd: 12.5,
      inputTokens: 1_000_000,
    });
    expect(r.value).toBe(12.5);
    expect(r.isEstimate).toBe(false);
  });

  it('estimates when cost missing', () => {
    const r = resolveCostUsd({
      kind: 'anthropic',
      inputTokens: 500_000,
      outputTokens: 100_000,
      modelId: 'claude-sonnet',
    });
    expect(r.isEstimate).toBe(true);
    expect(r.value).toBeGreaterThan(0);
  });

  it('does not estimate without an explicit model', () => {
    const r = resolveCostUsd({ kind: 'openai', inputTokens: 1_000_000 });
    expect(r.value).toBeNull();
    expect(r.isEstimate).toBe(false);
  });
});
