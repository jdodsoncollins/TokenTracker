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
    vi.useRealTimers();
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
            has_more: false,
            next_page: null,
          });
        }
        return jsonResponse({}, 404);
      }),
    );
    const res = await fetchProviderUsage('openai', 'sk-admin');
    expect(res.ok).toBe(true);
    expect(res.snapshot?.costUsd).toBe(5);
  });

  it('OpenAI admin keys return organization costs and completion token usage', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/organization/costs')) {
          return jsonResponse({
            data: [
              {
                start_time: 1_754_006_400,
                end_time: 1_754_092_800,
                results: [{ amount: { value: 68.46 } }],
              },
            ],
            has_more: false,
            next_page: null,
          });
        }
        if (String(url).includes('/organization/usage/completions')) {
          return jsonResponse({
            data: [
              {
                start_time: 1_754_006_400,
                end_time: 1_754_092_800,
                results: [
                  { input_tokens: 132_263_627, output_tokens: 421 },
                ],
              },
            ],
            has_more: false,
            next_page: null,
          });
        }
        return jsonResponse({}, 404);
      }),
    );

    const res = await fetchProviderUsage('openai', 'sk-admin');
    expect(res.snapshot).toMatchObject({
      costUsd: 68.46,
      inputTokens: 132_263_627,
      outputTokens: 421,
      totalTokens: 132_264_048,
      measurementKind: 'period',
    });
    expect(res.history).toEqual([
      expect.objectContaining({
        costUsd: 68.46,
        inputTokens: 132_263_627,
        outputTokens: 421,
        totalTokens: 132_264_048,
        periodStart: '2025-08-01T00:00:00.000Z',
        periodEnd: '2025-08-02T00:00:00.000Z',
        fetchedAt: '2025-08-01T00:00:00.000Z',
      }),
    ]);
    expect(res.snapshot?.windowLabel).toBe(
      'last 90 days (organization costs and completion tokens)',
    );
  });

  it('OpenAI paginates cost and completions daily buckets', async () => {
    const dayOne = 1_754_006_400;
    const dayTwo = dayOne + 86_400;
    const fetchMock = vi.fn(async (url: string) => {
      const requestUrl = new URL(String(url));
      const page = requestUrl.searchParams.get('page');
      expect(requestUrl.searchParams.get('limit')).toBe('31');

      if (requestUrl.pathname.endsWith('/organization/costs')) {
        if (page !== null) expect(page).toBe('cost-page-2');
        return page === null
          ? jsonResponse({
              data: [
                {
                  start_time: dayOne,
                  end_time: dayTwo,
                  results: [{ amount: { value: 1 } }],
                },
              ],
              has_more: true,
              next_page: 'cost-page-2',
            })
          : jsonResponse({
              data: [
                {
                  start_time: dayTwo,
                  end_time: dayTwo + 86_400,
                  results: [{ amount: { value: 2 } }],
                },
              ],
              has_more: false,
              next_page: null,
            });
      }
      if (requestUrl.pathname.endsWith('/organization/usage/completions')) {
        if (page !== null) expect(page).toBe('usage-page-2');
        return page === null
          ? jsonResponse({
              data: [
                {
                  start_time: dayOne,
                  end_time: dayTwo,
                  results: [{ input_tokens: 10, output_tokens: 1 }],
                },
              ],
              has_more: true,
              next_page: 'usage-page-2',
            })
          : jsonResponse({
              data: [
                {
                  start_time: dayTwo,
                  end_time: dayTwo + 86_400,
                  results: [{ input_tokens: 20, output_tokens: 2 }],
                },
              ],
              has_more: false,
              next_page: null,
            });
      }
      throw new Error(`Unexpected URL: ${url}`);
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchProviderUsage('openai', 'sk-admin');

    expect(res.snapshot).toMatchObject({
      costUsd: 3,
      inputTokens: 30,
      outputTokens: 3,
      totalTokens: 33,
    });
    expect(res.history).toHaveLength(2);
    expect(res.history?.[1]).toMatchObject({
      costUsd: 2,
      inputTokens: 20,
      outputTokens: 2,
    });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('normalizes partial OpenAI buckets to a stable UTC calendar day', async () => {
    const partialStart = Date.parse('2026-07-23T15:42:00.000Z') / 1000;
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/organization/costs')) {
        return jsonResponse({
          data: [
            {
              start_time: partialStart,
              end_time: partialStart + 900,
              results: [{ amount: { value: 2 } }],
            },
          ],
          has_more: false,
          next_page: null,
        });
      }
      return jsonResponse({
        data: [
          {
            start_time: partialStart,
            end_time: partialStart + 3_600,
            results: [{ input_tokens: 5, output_tokens: 1 }],
          },
        ],
        has_more: false,
        next_page: null,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchProviderUsage('openai', 'sk-admin');

    expect(res.history).toEqual([
      expect.objectContaining({
        costUsd: 2,
        inputTokens: 5,
        outputTokens: 1,
        periodStart: '2026-07-23T00:00:00.000Z',
        periodEnd: '2026-07-24T00:00:00.000Z',
        fetchedAt: '2026-07-23T00:00:00.000Z',
      }),
    ]);
  });

  it('OpenAI rejects repeated cost cursors without returning partial history', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname.endsWith('/organization/costs')) {
        return jsonResponse({
          data: [],
          has_more: true,
          next_page: 'same-cursor',
        });
      }
      return jsonResponse({ data: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchProviderUsage('openai', 'sk-admin');

    expect(res.ok).toBe(false);
    expect(res.history).toBeUndefined();
    expect(res.snapshot).toBeUndefined();
    expect(res.message).toMatch(/did not complete/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('OpenAI retains cost history and warns when completion pagination fails', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const requestUrl = new URL(String(url));
      if (requestUrl.pathname.endsWith('/organization/costs')) {
        return jsonResponse({
          data: [
            {
              start_time: 1_754_006_400,
              end_time: 1_754_092_800,
              results: [{ amount: { value: 7 } }],
            },
          ],
          has_more: false,
          next_page: null,
        });
      }
      if (requestUrl.pathname.endsWith('/organization/usage/completions')) {
        return requestUrl.searchParams.has('page')
          ? jsonResponse({ error: 'failed' }, 500)
          : jsonResponse({
              data: [],
              has_more: true,
              next_page: 'usage-page-2',
            });
      }
      return jsonResponse({ data: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchProviderUsage('openai', 'sk-admin');

    expect(res.ok).toBe(true);
    expect(res.history).toEqual([
      expect.objectContaining({ costUsd: 7, inputTokens: null }),
    ]);
    expect(res.snapshot?.costUsd).toBe(7);
    expect(res.message).toMatch(/did not complete/);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('OpenAI bounds pagination loops without returning partial history', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const requestUrl = new URL(String(url));
      expect(requestUrl.pathname).toMatch(/organization\/costs$/);
      return jsonResponse({
        data: [],
        has_more: true,
        next_page: `cursor-${fetchMock.mock.calls.length}`,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchProviderUsage('openai', 'sk-admin');

    expect(res.ok).toBe(false);
    expect(res.history).toBeUndefined();
    expect(res.snapshot).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(10);
  });

  it('OpenAI rejects bad keys', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'invalid' }, 401)),
    );
    const res = await fetchProviderUsage('openai', 'bad');
    expect(res.ok).toBe(false);
    expect(res.message).toMatch(/401/);
    expect(res.message).not.toContain('invalid');
  });

  it('falls back when OpenAI returns malformed cost data', async () => {
    const fetchMock = vi.fn(async (url: string) =>
      String(url).includes('/organization/costs')
        ? jsonResponse({})
        : jsonResponse({ data: [] }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchProviderUsage('openai', 'sk-test');
    expect(res.ok).toBe(true);
    expect(res.snapshot?.costUsd).toBeNull();
    expect(res.snapshot?.measurementKind).toBe('point');
  });

  it('rejects malformed OpenRouter usage data', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ data: {} })));
    await expect(fetchProviderUsage('openrouter', 'key')).resolves.toEqual({
      ok: false,
      message: 'OpenRouter returned an invalid response.',
    });
  });

  it('Anthropic aggregates documented usage fields across pages', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-23T12:00:00.000Z'));
    const fetchMock = vi.fn(async (url: string, _init?: RequestInit) => {
      const requestUrl = new URL(String(url));
      expect(requestUrl.searchParams.get('limit')).toBe('31');
      expect(requestUrl.searchParams.get('starting_at')).toBe(
        '2026-04-24T12:00:00.000Z',
      );
      expect(requestUrl.searchParams.get('ending_at')).toBe(
        '2026-07-23T12:00:00.000Z',
      );

      if (!requestUrl.searchParams.has('page')) {
        return jsonResponse({
          data: [
            {
              starting_at: '2025-08-01T00:00:00Z',
              ending_at: '2025-08-02T00:00:00Z',
              results: [
                {
                  uncached_input_tokens: 1500,
                  cache_read_input_tokens: 200,
                  cache_creation: {
                    ephemeral_1h_input_tokens: 1000,
                    ephemeral_5m_input_tokens: 500,
                  },
                  output_tokens: 500,
                },
              ],
            },
          ],
          has_more: true,
          next_page: 'next-token',
        });
      }

      expect(requestUrl.searchParams.get('page')).toBe('next-token');
      return jsonResponse({
        data: [
          {
            starting_at: '2025-08-02T00:00:00Z',
            ending_at: '2025-08-03T00:00:00Z',
            results: [
              {
                uncached_input_tokens: 20,
                cache_read_input_tokens: 30,
                cache_creation: {
                  ephemeral_1h_input_tokens: 40,
                  ephemeral_5m_input_tokens: 10,
                },
                output_tokens: 100,
              },
            ],
          },
        ],
        has_more: false,
        next_page: null,
      });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchProviderUsage('anthropic', 'sk-ant');
    expect(res.ok).toBe(true);
    expect(res.snapshot?.inputTokens).toBe(3300);
    expect(res.snapshot?.outputTokens).toBe(600);
    expect(res.snapshot?.totalTokens).toBe(3900);
    expect(res.snapshot?.windowLabel).toBe('last 90 days (usage report)');
    expect(res.history).toEqual([
      expect.objectContaining({
        periodStart: '2025-08-01T00:00:00.000Z',
        periodEnd: '2025-08-02T00:00:00.000Z',
        inputTokens: 3200,
        outputTokens: 500,
        totalTokens: 3700,
      }),
      expect.objectContaining({
        periodStart: '2025-08-02T00:00:00.000Z',
        periodEnd: '2025-08-03T00:00:00.000Z',
        inputTokens: 100,
        outputTokens: 100,
        totalTokens: 200,
      }),
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0]?.[1]?.signal).toBeInstanceOf(AbortSignal);
  });

  it('Anthropic stops when pagination repeats a cursor', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('usage_report')) {
        return jsonResponse({ data: [], has_more: true, next_page: 'same' });
      }
      return jsonResponse({ data: [] });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchProviderUsage('anthropic', 'sk-ant');
    expect(res.ok).toBe(false);
    expect(res.history).toBeUndefined();
    expect(res.message).toMatch(/did not complete/);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('Anthropic reports a partial pagination failure without validating away the error', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      const requestUrl = new URL(String(url));
      if (!requestUrl.pathname.includes('usage_report')) {
        throw new Error('models validation must not run');
      }
      return requestUrl.searchParams.has('page')
        ? jsonResponse({ malformed: true })
        : jsonResponse({
            data: [
              {
                starting_at: '2026-07-22T00:00:00Z',
                ending_at: '2026-07-23T00:00:00Z',
                results: [{ uncached_input_tokens: 10, output_tokens: 2 }],
              },
            ],
            has_more: true,
            next_page: 'page-2',
          });
    });
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchProviderUsage('anthropic', 'sk-ant');

    expect(res).toEqual({
      ok: false,
      message: 'Anthropic usage history request did not complete. Existing history was kept.',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('returns empty history for completed reports with zero buckets', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (String(url).includes('/organization/costs')) {
          return jsonResponse({ data: [], has_more: false, next_page: null });
        }
        return jsonResponse({ data: [], has_more: false, next_page: null });
      }),
    );

    const openAi = await fetchProviderUsage('openai', 'sk-admin');
    const anthropic = await fetchProviderUsage('anthropic', 'sk-ant-admin');

    expect(openAi.history).toEqual([]);
    expect(anthropic.history).toEqual([]);
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
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ error: 'secret response body' }, 401)),
    );
    const res = await fetchProviderUsage('xai', 'bad');
    expect(res.ok).toBe(false);
    expect(res.message).toBe('xAI request failed (401).');
  });

  it('Google validates models list', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        expect(String(url)).toBe(
          'https://generativelanguage.googleapis.com/v1beta/models',
        );
        expect(init?.headers).toEqual({ 'x-goog-api-key': 'AIza-test' });
        expect(init?.signal).toBeInstanceOf(AbortSignal);
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

  it.each([
    ['not a URL', 'Custom base URL is invalid.'],
    [
      'https://user:password@proxy.example.com',
      'Custom base URL must not include credentials.',
    ],
    ['http://proxy.example.com', 'Custom base URL must use HTTPS.'],
  ])('rejects unsafe custom base URL %s', async (baseUrl, message) => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const res = await fetchProviderUsage('custom', 'key', baseUrl);
    expect(res).toEqual({ ok: false, message });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows and normalizes localhost development endpoints', async () => {
    vi.stubGlobal('__DEV__', true);
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        expect(String(url)).toBe('http://127.0.0.1:8080/api/v1/models');
        return jsonResponse({ data: [] });
      }),
    );

    const res = await fetchProviderUsage(
      'custom',
      '',
      'http://127.0.0.1:8080/api/?token=secret#fragment',
    );
    expect(res.ok).toBe(true);
  });

  it('returns a fixed network message and supplies an abort signal', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      async (_url: string, init?: RequestInit): Promise<Response> =>
        new Promise((_resolve, reject) => {
          expect(init?.signal).toBeInstanceOf(AbortSignal);
          init?.signal?.addEventListener('abort', () =>
            reject(new Error('response body must not escape')),
          );
        }),
    );
    vi.stubGlobal('fetch', fetchMock);

    const pending = fetchProviderUsage('xai', 'key');
    await vi.advanceTimersByTimeAsync(15_000);
    await expect(pending).resolves.toEqual({
      ok: false,
      message: 'Network request timed out or failed.',
    });
  });
});
