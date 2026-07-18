import { describe, expect, it } from 'vitest';
import { PROVIDER_CATALOG, PROVIDER_ORDER } from '../src/services/providers/catalog';

describe('provider catalog', () => {
  it('includes core LLM providers', () => {
    expect(PROVIDER_ORDER).toContain('openai');
    expect(PROVIDER_ORDER).toContain('anthropic');
    expect(PROVIDER_ORDER).toContain('xai');
    expect(PROVIDER_ORDER).toContain('openrouter');
  });

  it('has definitions for every ordered kind', () => {
    for (const kind of PROVIDER_ORDER) {
      expect(PROVIDER_CATALOG[kind].kind).toBe(kind);
      expect(PROVIDER_CATALOG[kind].name.length).toBeGreaterThan(0);
    }
  });
});
