import { describe, expect, it } from 'vitest';
import {
  DEFAULT_MODEL_BY_KIND,
  defaultModelForKind,
  estimateCostFromTokens,
  getModelRate,
  MODEL_RATES,
  resolveCostUsd,
} from '../src/services/pricing';
import type { ProviderKind } from '../src/types';

describe('pricing catalog integrity', () => {
  it('has a default model for every provider kind', () => {
    const kinds: ProviderKind[] = [
      'openai',
      'anthropic',
      'xai',
      'openrouter',
      'google',
      'custom',
    ];
    for (const kind of kinds) {
      const model = defaultModelForKind(kind);
      expect(model.id).toBe(DEFAULT_MODEL_BY_KIND[kind]);
      expect(model.inputPerMTok).toBeGreaterThanOrEqual(0);
      expect(model.outputPerMTok).toBeGreaterThanOrEqual(0);
    }
  });

  it('falls back to generic for unknown model ids', () => {
    expect(getModelRate('nope-model').id).toBe('generic');
  });

  it('exposes positive rates for core models', () => {
    expect(MODEL_RATES['gpt-4o'].inputPerMTok).toBeGreaterThan(0);
    expect(MODEL_RATES['claude-sonnet'].outputPerMTok).toBeGreaterThan(0);
  });
});

describe('estimateCostFromTokens edge cases', () => {
  it('returns zero when no tokens', () => {
    const est = estimateCostFromTokens({ kind: 'openai' });
    expect(est.costUsd).toBe(0);
  });

  it('uses provider default when model omitted', () => {
    const est = estimateCostFromTokens({
      kind: 'anthropic',
      inputTokens: 1_000_000,
      outputTokens: 0,
    });
    expect(est.model.id).toBe('claude-sonnet');
    expect(est.costUsd).toBeCloseTo(3, 5);
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
    });
    expect(r.isEstimate).toBe(true);
    expect(r.value).toBe(0);
  });
});
