import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createManualSnapshot,
  fetchProviderUsage,
} from '../src/services/providers/fetchUsage';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('createManualSnapshot', () => {
  it('handles cost-only entries', () => {
    const s = createManualSnapshot({ costUsd: 9.99 });
    expect(s.costUsd).toBe(9.99);
    expect(s.totalTokens).toBeNull();
    expect(s.source).toBe('manual');
  });

  it('handles input-only tokens', () => {
    const s = createManualSnapshot({ inputTokens: 100 });
    expect(s.totalTokens).toBe(100);
    expect(s.outputTokens).toBeNull();
  });
});

describe('fetchProviderUsage', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('OpenRouter returns lifetime usage cost', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(String(url)).toContain('openrouter.ai');
        return jsonResponse({ data: { usage: 12.34, label: 'default' } });
      }),
    );
    const res = await fetchProviderUsage('openrouter', 'sk-or-test');
    expect(res.ok).toBe(true);
    expect(res.snapshot?.costUsd).toBe(12.34);
    expect(res.snapshot?.source).toBe('api');
  });

  it('OpenAI falls back to models validation when costs fail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/organization/costs')) {
          return jsonResponse({ error: 'forbidden' }, 403);
        }
        if (String(url).includes('/models')) {
          return jsonResponse({ data: [] });
        }
        return jsonResponse({}, 404);
      }),
    );
    const res = await fetchProviderUsage('openai', 'sk-test');
    expect(res.ok).toBe(true);
    expect(res.validated).toBe(true);
    expect(res.snapshot?.costUsd).toBeNull();
    expect(res.message).toMatch(/admin/i);
  });

  it('OpenAI sums org costs when available', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/organization/costs')) {
          return jsonResponse({
            data: [
              { results: [{ amount: { value: 1.5 } }, { amount: { value: 2.5 } }] },
              { results: [{ amount: { value: 1 } }] },
            ],
          });
        }
        return jsonResponse({}, 404);
      }),
    );
    const res = await fetchProviderUsage('openai', 'sk-admin');
    expect(res.ok).toBe(true);
    expect(res.snapshot?.costUsd).toBe(5);
  });

  it('OpenAI rejects bad keys', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'invalid' }, 401)),
    );
    const res = await fetchProviderUsage('openai', 'bad');
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/401/);
  });

  it('Anthropic aggregates usage report tokens', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('usage_report')) {
          return jsonResponse({
            data: [
              { usage: { input_tokens: 100, output_tokens: 50 } },
              { usage: { input_tokens: 20, output_tokens: 30 } },
            ],
          });
        }
        return jsonResponse({}, 404);
      }),
    );
    const res = await fetchProviderUsage('anthropic', 'sk-ant');
    expect(res.ok).toBe(true);
    expect(res.snapshot?.inputTokens).toBe(120);
    expect(res.snapshot?.outputTokens).toBe(80);
    expect(res.snapshot?.totalTokens).toBe(200);
  });

  it('Anthropic validates via models without calling messages', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('usage_report')) {
        return jsonResponse({}, 403);
      }
      if (String(url).includes('/models')) {
        return jsonResponse({ data: [] });
      }
      throw new Error(`unexpected url ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);
    const res = await fetchProviderUsage('anthropic', 'sk-ant');
    expect(res.ok).toBe(true);
    // Must not hit chat completions (/v1/messages) — usage_report/.../messages is OK
    expect(
      fetchMock.mock.calls.every(
        (c) => !String(c[0]).includes('/v1/messages'),
      ),
    ).toBe(true);
  });

  it('Anthropic rejects 401 on models', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('usage_report')) return jsonResponse({}, 403);
        return jsonResponse({}, 401);
      }),
    );
    const res = await fetchProviderUsage('anthropic', 'bad');
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/rejected/i);
  });

  it('xAI validates models endpoint', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ data: [] })));
    const res = await fetchProviderUsage('xai', 'xai-key');
    expect(res.ok).toBe(true);
    expect(res.validated).toBe(true);
  });

  it('xAI fails on bad key', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({}, 401)));
    const res = await fetchProviderUsage('xai', 'bad');
    expect(res.ok).toBe(false);
  });

  it('Google validates models list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(String(url)).toContain('generativelanguage.googleapis.com');
        expect(String(url)).toContain('key=AIza');
        return jsonResponse({ models: [] });
      }),
    );
    const res = await fetchProviderUsage('google', 'AIza-test');
    expect(res.ok).toBe(true);
  });

  it('custom without base URL is manual mode', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await fetchProviderUsage('custom', '');
    expect(res.ok).toBe(true);
    expect(res.validated).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('custom with base URL hits /v1/models', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(String(url)).toBe('https://proxy.example.com/v1/models');
        return jsonResponse({ data: [] });
      }),
    );
    const res = await fetchProviderUsage(
      'custom',
      'key',
      'https://proxy.example.com/v1',
    );
    expect(res.ok).toBe(true);
    expect(res.validated).toBe(true);
  });

  it('custom base without /v1 appends it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(String(url)).toBe('https://proxy.example.com/v1/models');
        return jsonResponse({ data: [] });
      }),
    );
    const res = await fetchProviderUsage(
      'custom',
      'key',
      'https://proxy.example.com',
    );
    expect(res.ok).toBe(true);
  });
});
