import type { ProviderKind, UsageSnapshot } from '../../types';

export interface FetchResult {
  ok: boolean;
  snapshot?: UsageSnapshot;
  validated?: boolean;
  message?: string;
}

const REQUEST_TIMEOUT_MS = 15_000;
const NETWORK_ERROR_MESSAGE = 'Network request timed out or failed.';

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
  const start = end - 30 * 24 * 60 * 60;
  try {
    const costsRes = await providerFetch(
      `https://api.openai.com/v1/organization/costs?start_time=${start}&end_time=${end}&bucket_width=1d&limit=31`,
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      },
    );
    if (costsRes.ok) {
      const data = (await safeJson(costsRes)) as {
        data?: Array<{ results?: Array<{ amount?: { value?: number } }> }>;
      } | null;
      if (
        !Array.isArray(data?.data) ||
        !data.data.every((bucket) => Array.isArray(bucket.results))
      ) {
        throw new Error('Invalid OpenAI costs response.');
      }
      let total = 0;
      for (const bucket of data.data) {
        for (const r of bucket.results ?? []) {
          total += nonnegativeNumber(r.amount?.value) ?? 0;
        }
      }
      return {
        ok: true,
        validated: true,
        snapshot: snap({
          costUsd: total,
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          measurementKind: 'period',
          periodStart: new Date(start * 1000).toISOString(),
          periodEnd: new Date(end * 1000).toISOString(),
          source: 'api',
          windowLabel: 'last 30 days (org costs)',
        }),
      };
    }
  } catch {
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
        'Key works. Cost auto-fetch needs an organization admin key — add a manual snapshot for spend.',
      snapshot: snap({
        costUsd: null,
        inputTokens: null,
        outputTokens: null,
        totalTokens: null,
        measurementKind: 'point',
        source: 'api',
        windowLabel: 'key validated · costs unavailable',
        note: 'Use manual entry or an sk-admin key for org costs.',
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
    const periodStart = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const periodEnd = new Date().toISOString();
    const params = new URLSearchParams({
      starting_at: periodStart,
      ending_at: periodEnd,
      bucket_width: '1d',
      limit: '31',
    });
    const endpoint =
      'https://api.anthropic.com/v1/organizations/usage_report/messages';
    const seenPages = new Set<string>();
    let input = 0;
    let output = 0;
    let pageCount = 0;

    while (pageCount < 100) {
      const usageRes = await providerFetch(`${endpoint}?${params}`, { headers });
      if (!usageRes.ok) break;

      const data = (await safeJson(usageRes)) as {
        data?: Array<{
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
        break;
      }

      for (const bucket of data.data) {
        for (const result of bucket.results ?? []) {
          input += nonnegativeNumber(result.uncached_input_tokens) ?? 0;
          input += nonnegativeNumber(result.cache_read_input_tokens) ?? 0;
          input +=
            nonnegativeNumber(result.cache_creation?.ephemeral_5m_input_tokens) ?? 0;
          input +=
            nonnegativeNumber(result.cache_creation?.ephemeral_1h_input_tokens) ?? 0;
          output += nonnegativeNumber(result.output_tokens) ?? 0;
        }
      }

      pageCount += 1;
      if (!data?.has_more) {
        return {
          ok: true,
          validated: true,
          snapshot: snap({
            costUsd: null,
            inputTokens: input,
            outputTokens: output,
            totalTokens: input + output,
            measurementKind: 'period',
            periodStart,
            periodEnd,
            source: 'api',
            windowLabel: 'last 30 days (usage report)',
          }),
        };
      }

      const nextPage = data.next_page;
      if (!nextPage || seenPages.has(nextPage)) break;
      seenPages.add(nextPage);
      params.set('page', nextPage);
    }
  } catch {
    // fall through
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
