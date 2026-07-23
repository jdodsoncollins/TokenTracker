import { describe, expect, it } from 'vitest';
import {
  estimateCostFromTokens,
  getModelRate,
  MODEL_RATES,
  modelRatesForProvider,
  resolveCostUsd,
} from '../src/services/pricing';

describe('pricing catalog integrity', () => {
  it('filters selectable models by provider', () => {
    expect(modelRatesForProvider('openai').map((model) => model.id)).toEqual([
      'gpt-4o',
      'gpt-4o-mini',
      'o3-mini',
    ]);
    expect(
      modelRatesForProvider('anthropic').every((model) =>
        model.id.startsWith('claude'),
      ),
    ).toBe(true);
  });

  it('rejects unknown model ids instead of substituting a rate', () => {
    expect(getModelRate('nope-model')).toBeNull();
  });

  it('exposes positive rates for core models', () => {
    expect(MODEL_RATES['gpt-4o'].inputPerMTok).toBeGreaterThan(0);
    expect(MODEL_RATES['claude-sonnet'].outputPerMTok).toBeGreaterThan(0);
  });
});

describe('estimateCostFromTokens edge cases', () => {
  it('returns zero when no tokens', () => {
    const est = estimateCostFromTokens({ kind: 'openai', modelId: 'gpt-4o-mini' });
    expect(est.costUsd).toBe(0);
  });

  it('rejects an unknown explicit model', () => {
    expect(() =>
      estimateCostFromTokens({ kind: 'anthropic', modelId: 'missing' }),
    ).toThrow('Unknown pricing model');
  });
});

describe('resolveCostUsd edge cases', () => {
  it('returns null without cost or tokens', () => {
    expect(resolveCostUsd({ kind: 'openai' }).value).toBeNull();
  });

  it('treats zero cost as reported', () => {
    const r = resolveCostUsd({ kind: 'openai', costUsd: 0 });
    expect(r.value).toBe(0);
    expect(r.isEstimate).toBe(false);
  });

  it('estimates zero tokens as zero estimate', () => {
    const r = resolveCostUsd({
      kind: 'openai',
      inputTokens: 0,
      outputTokens: 0,
      modelId: 'gpt-4o-mini',
    });
    expect(r.isEstimate).toBe(true);
    expect(r.value).toBe(0);
  });
});
