import type { ProviderKind, UsageSnapshot } from '../../types';

export interface FetchResult {
  ok: boolean;
  snapshot?: UsageSnapshot;
  history?: UsageSnapshot[];
  validated?: boolean;
  message?: string;
}

const REQUEST_TIMEOUT_MS = 15_000;
const NETWORK_ERROR_MESSAGE = 'Network request timed out or failed.';
const HISTORY_DAYS = 90;
const DAILY_PAGE_LIMIT = 31;
const MAX_REPORT_PAGES = 10;

async function providerFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

function nonnegativeNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : null;
}

function snap(
  partial: Omit<UsageSnapshot, 'fetchedAt'> & { fetchedAt?: string },
): UsageSnapshot {
  return { fetchedAt: nowIso(), ...partial };
}

function openAiUtcDay(
  start: unknown,
): { periodStart: string; periodEnd: string } | null {
  if (
    typeof start !== 'number' ||
    !Number.isFinite(start) ||
    start < 0
  ) {
    return null;
  }
  const startDate = new Date(start * 1000);
  if (!Number.isFinite(startDate.getTime())) {
    return null;
  }
  const utcMidnight = Date.UTC(
    startDate.getUTCFullYear(),
    startDate.getUTCMonth(),
    startDate.getUTCDate(),
  );
  return {
    periodStart: new Date(utcMidnight).toISOString(),
    periodEnd: new Date(utcMidnight + 24 * 60 * 60 * 1000).toISOString(),
  };
}

function isoPeriod(
  start: unknown,
  end: unknown,
): { periodStart: string; periodEnd: string } | null {
  if (typeof start !== 'string' || typeof end !== 'string') return null;
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return null;
  }
  return {
    periodStart: new Date(startMs).toISOString(),
    periodEnd: new Date(endMs).toISOString(),
  };
}

function periodKey(period: { periodStart: string; periodEnd: string }): string {
  return `${period.periodStart}:${period.periodEnd}`;
}

interface OpenAIPage<T> {
  data?: T[];
  has_more?: boolean;
  next_page?: string | null;
}

class IncompleteOpenAIReportError extends Error {}
class IncompleteAnthropicReportError extends Error {}

async function fetchOpenAIPages<T>(
  endpoint: string,
  params: URLSearchParams,
  headers: Record<string, string>,
  validItem: (item: T) => boolean,
): Promise<T[] | null> {
  const items: T[] = [];
  const seenPages = new Set<string>();

  for (let pageCount = 0; pageCount < MAX_REPORT_PAGES; pageCount += 1) {
    let response: Response;
    try {
      response = await providerFetch(`${endpoint}?${params}`, { headers });
    } catch {
      throw new IncompleteOpenAIReportError();
    }
    if (!response.ok) {
      if (pageCount === 0) return null;
      throw new IncompleteOpenAIReportError();
    }

    const page = (await safeJson(response)) as OpenAIPage<T> | null;
    if (
      !page ||
      !Array.isArray(page.data) ||
      typeof page.has_more !== 'boolean' ||
      !page.data.every(validItem)
    ) {
      if (pageCount > 0) throw new IncompleteOpenAIReportError();
      throw new Error('Invalid OpenAI report response.');
    }
    items.push(...page.data);

    if (!page.has_more) return items;
    if (!page.next_page || seenPages.has(page.next_page)) {
      throw new IncompleteOpenAIReportError();
    }
    seenPages.add(page.next_page);
    params.set('page', page.next_page);
  }

  throw new IncompleteOpenAIReportError();
}

async function safeJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/** OpenAI — try org costs (admin), fall back to key validation via /models. */
async function fetchOpenAI(apiKey: string): Promise<FetchResult> {
  // Costs API (organization admin keys)
  const end = Math.floor(Date.now() / 1000);
  const start = end - HISTORY_DAYS * 24 * 60 * 60;
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  try {
    const reportParams = new URLSearchParams({
      start_time: String(start),
      end_time: String(end),
      bucket_width: '1d',
      limit: String(DAILY_PAGE_LIMIT),
    });
    const costs = await fetchOpenAIPages<{
      start_time?: number;
      end_time?: number;
      results?: Array<{ amount?: { value?: number } }>;
    }>(
      'https://api.openai.com/v1/organization/costs',
      new URLSearchParams(reportParams),
      headers,
      (bucket) => Array.isArray(bucket.results),
    );
    if (costs) {
      let total = 0;
      const fetchedAt = nowIso();
      const daily = new Map<
        string,
        {
          periodStart: string;
          periodEnd: string;
          costUsd: number;
          input: number | null;
          output: number | null;
        }
      >();
      for (const bucket of costs) {
        let bucketCost = 0;
        for (const r of bucket.results ?? []) {
          bucketCost += nonnegativeNumber(r.amount?.value) ?? 0;
        }
        total += bucketCost;
        const period = openAiUtcDay(bucket.start_time);
        if (period) {
          const key = periodKey(period);
          const existing = daily.get(key);
          daily.set(key, {
            ...period,
            costUsd: (existing?.costUsd ?? 0) + bucketCost,
            input: existing?.input ?? null,
            output: existing?.output ?? null,
          });
        }
      }
      let inputTokens: number | null = null;
      let outputTokens: number | null = null;
      let usage: Array<{
        start_time?: number;
        end_time?: number;
        results?: Array<{ input_tokens?: number; output_tokens?: number }>;
      }> | null = null;
      let usageWarning: string | undefined;
      try {
        usage = await fetchOpenAIPages(
          'https://api.openai.com/v1/organization/usage/completions',
          new URLSearchParams(reportParams),
          headers,
          (bucket) => Array.isArray(bucket.results),
        );
        if (usage === null) {
          usageWarning =
            'Organization costs loaded, but OpenAI completion token history is unavailable.';
        }
      } catch {
        usageWarning =
          'Organization costs loaded, but OpenAI completion token history did not complete.';
      }
      if (usage) {
        inputTokens = 0;
        outputTokens = 0;
        for (const bucket of usage) {
          let bucketInput = 0;
          let bucketOutput = 0;
          for (const result of bucket.results ?? []) {
            bucketInput += nonnegativeNumber(result.input_tokens) ?? 0;
            bucketOutput += nonnegativeNumber(result.output_tokens) ?? 0;
          }
          inputTokens += bucketInput;
          outputTokens += bucketOutput;
          const period = openAiUtcDay(bucket.start_time);
          if (period) {
            const key = periodKey(period);
            const existing = daily.get(key);
            daily.set(key, {
              ...period,
              costUsd: existing?.costUsd ?? 0,
              input: (existing?.input ?? 0) + bucketInput,
              output: (existing?.output ?? 0) + bucketOutput,
            });
          }
        }
      }
      return {
        ok: true,
        validated: true,
        message: usageWarning,
        history:
          daily.size > 0
            ? Array.from(daily.values()).map((bucket) => ({
                costUsd: bucket.costUsd,
                inputTokens: bucket.input,
                outputTokens: bucket.output,
                totalTokens:
                  bucket.input != null && bucket.output != null
                    ? bucket.input + bucket.output
                    : null,
                measurementKind: 'period',
                periodStart: bucket.periodStart,
                periodEnd: bucket.periodEnd,
                source: 'api',
                fetchedAt: bucket.periodStart,
                windowLabel: 'daily organization costs and completion tokens',
              }))
            : [],
        snapshot: snap({
          fetchedAt,
          costUsd: total,
          inputTokens,
          outputTokens,
          totalTokens:
            inputTokens != null && outputTokens != null
              ? inputTokens + outputTokens
              : null,
          measurementKind: 'period',
          periodStart: new Date(start * 1000).toISOString(),
          periodEnd: new Date(end * 1000).toISOString(),
          source: 'api',
          windowLabel:
            inputTokens != null
              ? 'last 90 days (organization costs and completion tokens)'
              : 'last 90 days (organization costs)',
        }),
      };
    }
  } catch (error) {
    if (error instanceof IncompleteOpenAIReportError) {
      return {
        ok: false,
        message: 'OpenAI organization history request did not complete.',
      };
    }
    // continue to models probe
  }

  const modelsRes = await providerFetch('https://api.openai.com/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (modelsRes.ok) {
    return {
      ok: true,
      validated: true,
      message:
        'Key works. Organization costs and completion token history require an organization admin key. Manual snapshots remain visible after refresh.',
      snapshot: snap({
        costUsd: null,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        measurementKind: 'point',
        source: 'api',
        windowLabel: 'key validated · costs unavailable',
        note: 'Use manual entry or an organization admin key for automatic usage.',
      }),
    };
  }
  return {
    ok: false,
    message: `OpenAI request failed (${modelsRes.status}).`,
  };
}

/** Anthropic — validate via models; try admin usage if available. */
async function fetchAnthropic(apiKey: string): Promise<FetchResult> {
  const headers = {
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
  };

  // Admin usage report (requires admin key + org access)
  try {
    const periodEndMs = Date.now();
    const periodStart = new Date(
      periodEndMs - HISTORY_DAYS * 24 * 60 * 60 * 1000,
    ).toISOString();
    const periodEnd = new Date(periodEndMs).toISOString();
    const params = new URLSearchParams({
      starting_at: periodStart,
      ending_at: periodEnd,
      bucket_width: '1d',
      limit: String(DAILY_PAGE_LIMIT),
    });
    const endpoint =
      'https://api.anthropic.com/v1/organizations/usage_report/messages';
    const seenPages = new Set<string>();
    let input = 0;
    let output = 0;
    let pageCount = 0;
    const fetchedAt = nowIso();
    const daily = new Map<
      string,
      { periodStart: string; periodEnd: string; input: number; output: number }
    >();

    while (pageCount < MAX_REPORT_PAGES) {
      let usageRes: Response;
      try {
        usageRes = await providerFetch(`${endpoint}?${params}`, { headers });
      } catch {
        throw new IncompleteAnthropicReportError();
      }
      if (!usageRes.ok) {
        if (pageCount === 0) break;
        throw new IncompleteAnthropicReportError();
      }

      const data = (await safeJson(usageRes)) as {
        data?: Array<{
          starting_at?: string;
          ending_at?: string;
          results?: Array<{
            uncached_input_tokens?: number;
            cache_read_input_tokens?: number;
            cache_creation?: {
              ephemeral_5m_input_tokens?: number;
              ephemeral_1h_input_tokens?: number;
            };
            output_tokens?: number;
          }>;
        }>;
        has_more?: boolean;
        next_page?: string | null;
      } | null;

      if (
        !data ||
        !Array.isArray(data.data) ||
        typeof data.has_more !== 'boolean' ||
        !data.data.every((bucket) => Array.isArray(bucket.results))
      ) {
        throw new IncompleteAnthropicReportError();
      }

      for (const bucket of data.data) {
        let bucketInput = 0;
        let bucketOutput = 0;
        for (const result of bucket.results ?? []) {
          bucketInput += nonnegativeNumber(result.uncached_input_tokens) ?? 0;
          bucketInput += nonnegativeNumber(result.cache_read_input_tokens) ?? 0;
          bucketInput +=
            nonnegativeNumber(result.cache_creation?.ephemeral_5m_input_tokens) ?? 0;
          bucketInput +=
            nonnegativeNumber(result.cache_creation?.ephemeral_1h_input_tokens) ?? 0;
          bucketOutput += nonnegativeNumber(result.output_tokens) ?? 0;
        }
        input += bucketInput;
        output += bucketOutput;
        const period = isoPeriod(bucket.starting_at, bucket.ending_at);
        if (period) {
          const key = periodKey(period);
          const existing = daily.get(key);
          daily.set(key, {
            ...period,
            input: (existing?.input ?? 0) + bucketInput,
            output: (existing?.output ?? 0) + bucketOutput,
          });
        }
      }

      pageCount += 1;
      if (!data?.has_more) {
        return {
          ok: true,
          validated: true,
          history:
            daily.size > 0
              ? Array.from(daily.values()).map((bucket) => ({
                  costUsd: null,
                  inputTokens: bucket.input,
                  outputTokens: bucket.output,
                  totalTokens: bucket.input + bucket.output,
                  measurementKind: 'period',
                  periodStart: bucket.periodStart,
                  periodEnd: bucket.periodEnd,
                  source: 'api',
                  fetchedAt: bucket.periodStart,
                  windowLabel: 'daily usage report',
                }))
              : [],
          snapshot: snap({
            fetchedAt,
            costUsd: null,
            inputTokens: input,
            outputTokens: output,
            totalTokens: input + output,
            measurementKind: 'period',
            periodStart,
            periodEnd,
            source: 'api',
            windowLabel: 'last 90 days (usage report)',
          }),
        };
      }

      const nextPage = data.next_page;
      if (!nextPage || seenPages.has(nextPage)) {
        throw new IncompleteAnthropicReportError();
      }
      seenPages.add(nextPage);
      params.set('page', nextPage);
    }
    if (pageCount >= MAX_REPORT_PAGES) {
      throw new IncompleteAnthropicReportError();
    }
  } catch (error) {
    if (error instanceof IncompleteAnthropicReportError) {
      return {
        ok: false,
        message: 'Anthropic usage history request did not complete. Existing history was kept.',
      };
    }
  }

  // Validate with models list only — never call /messages (would spend tokens).
  try {
    const modelsRes = await providerFetch(
      'https://api.anthropic.com/v1/models?limit=1',
      { headers },
    );
    if (modelsRes.status === 401 || modelsRes.status === 403) {
      return { ok: false, message: 'Anthropic rejected the API key.' };
    }
    if (modelsRes.ok) {
      return {
        ok: true,
        validated: true,
        message:
          'Key works. Add a manual cost snapshot or use an admin key for usage reports.',
        snapshot: snap({
          costUsd: null,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          measurementKind: 'point',
          source: 'api',
          windowLabel: 'key validated · usage report unavailable',
        }),
      };
    }
    // Non-auth errors (e.g. 404 on older API shapes): treat key as stored, manual usage OK.
    return {
      ok: true,
      validated: false,
      message: `Anthropic returned ${modelsRes.status}. Key saved — use manual snapshots if auto-usage is unavailable.`,
      snapshot: snap({
        costUsd: null,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        measurementKind: 'point',
        source: 'unknown',
        windowLabel: 'key saved',
      }),
    };
  } catch {
    return {
      ok: false,
      message: NETWORK_ERROR_MESSAGE,
    };
  }
}

/** xAI / Grok */
async function fetchXai(apiKey: string): Promise<FetchResult> {
  const res = await providerFetch('https://api.x.ai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    return {
      ok: false,
      message: `xAI request failed (${res.status}).`,
    };
  }
  return {
    ok: true,
    validated: true,
    message: 'Grok key works. Log a manual spend snapshot when you want cost history.',
    snapshot: snap({
      costUsd: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      measurementKind: 'point',
      source: 'api',
      windowLabel: 'key validated',
    }),
  };
}

/** OpenRouter — excellent first-class usage on the key endpoint. */
async function fetchOpenRouter(apiKey: string): Promise<FetchResult> {
  const res = await providerFetch('https://openrouter.ai/api/v1/auth/key', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    return {
      ok: false,
      message: `OpenRouter request failed (${res.status}).`,
    };
  }
  const body = (await safeJson(res)) as {
    data?: { usage?: number; limit?: number | null; label?: string };
  } | null;
  const usage = nonnegativeNumber(body?.data?.usage);
  if (usage == null) {
    return { ok: false, message: 'OpenRouter returned an invalid response.' };
  }
  return {
    ok: true,
    validated: true,
    snapshot: snap({
      costUsd: usage,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      measurementKind: 'cumulative',
      source: 'api',
      windowLabel: 'lifetime (OpenRouter key usage)',
      note: body?.data?.label,
    }),
  };
}

/** Google AI Studio */
async function fetchGoogle(apiKey: string): Promise<FetchResult> {
  const res = await providerFetch(
    'https://generativelanguage.googleapis.com/v1beta/models',
    { headers: { 'x-goog-api-key': apiKey } },
  );
  if (!res.ok) {
    return {
      ok: false,
      message: `Google AI request failed (${res.status}).`,
    };
  }
  return {
    ok: true,
    validated: true,
    message: 'Gemini key works. Track spend with manual snapshots.',
    snapshot: snap({
      costUsd: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      measurementKind: 'point',
      source: 'api',
      windowLabel: 'key validated',
    }),
  };
}

/** Custom OpenAI-compatible base URL */
async function fetchCustom(apiKey: string, baseUrl?: string): Promise<FetchResult> {
  if (!baseUrl) {
    return {
      ok: true,
      validated: false,
      message: 'Custom provider saved. Add a base URL to validate, or log usage manually.',
      snapshot: snap({
        costUsd: null,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        measurementKind: 'point',
        source: 'unknown',
        windowLabel: 'manual',
      }),
    };
  }
  let parsed: URL;
  try {
    parsed = new URL(baseUrl);
  } catch {
    return { ok: false, message: 'Custom base URL is invalid.' };
  }
  if (parsed.username || parsed.password) {
    return {
      ok: false,
      message: 'Custom base URL must not include credentials.',
    };
  }
  const isLocalDevelopment =
    parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1';
  const allowInsecureLocalhost =
    typeof __DEV__ !== 'undefined' && __DEV__ && isLocalDevelopment;
  if (
    parsed.protocol !== 'https:' &&
    !(parsed.protocol === 'http:' && allowInsecureLocalhost)
  ) {
    return {
      ok: false,
      message: 'Custom base URL must use HTTPS.',
    };
  }
  const rootPath = parsed.pathname.replace(/\/+$/, '');
  parsed.pathname = rootPath.endsWith('/v1')
    ? `${rootPath}/models`
    : `${rootPath}/v1/models`;
  parsed.search = '';
  parsed.hash = '';
  const url = parsed.toString();
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await providerFetch(url, { headers });
  if (!res.ok) {
    return {
      ok: false,
      message: `Custom endpoint request failed (${res.status}).`,
    };
  }
  return {
    ok: true,
    validated: true,
    snapshot: snap({
      costUsd: null,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      measurementKind: 'point',
      source: 'api',
      windowLabel: 'endpoint validated',
    }),
  };
}

/**
 * Fetch usage / validate credentials for a provider.
 * Network only goes to the provider you configured — never to TokenTracker.
 */
export async function fetchProviderUsage(
  kind: ProviderKind,
  apiKey: string,
  baseUrl?: string,
): Promise<FetchResult> {
  try {
    switch (kind) {
      case 'openai':
        return await fetchOpenAI(apiKey);
      case 'anthropic':
        return await fetchAnthropic(apiKey);
      case 'xai':
        return await fetchXai(apiKey);
      case 'openrouter':
        return await fetchOpenRouter(apiKey);
      case 'google':
        return await fetchGoogle(apiKey);
      case 'custom':
        return await fetchCustom(apiKey, baseUrl);
      default:
        return { ok: false, message: 'Unknown provider' };
    }
  } catch {
    return { ok: false, message: NETWORK_ERROR_MESSAGE };
  }
}

export function createManualSnapshot(input: {
  costUsd?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  modelId?: string;
  measurementKind?: UsageSnapshot['measurementKind'];
  note?: string;
}): UsageSnapshot {
  const inputTokens = input.inputTokens ?? null;
  const outputTokens = input.outputTokens ?? null;
  const total =
    inputTokens != null || outputTokens != null
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : null;
  return {
    costUsd: input.costUsd ?? null,
    inputTokens,
    outputTokens,
    totalTokens: total,
    modelId: input.modelId,
    measurementKind: input.measurementKind ?? 'point',
    note: input.note,
    source: 'manual',
    fetchedAt: nowIso(),
    windowLabel: 'manual entry',
  };
}
