import type { ProviderKind, UsageSnapshot } from '../../types';

export interface FetchResult {
  ok: boolean;
  snapshot?: UsageSnapshot;
  validated?: boolean;
  message?: string;
}

function nowIso(): string {
  return new Date().toISOString();
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
    return { raw: text };
  }
}

/** OpenAI — try org costs (admin), fall back to key validation via /models. */
async function fetchOpenAI(apiKey: string): Promise<FetchResult> {
  // Costs API (organization admin keys)
  const end = Math.floor(Date.now() / 1000);
  const start = end - 30 * 24 * 60 * 60;
  try {
    const costsRes = await fetch(
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
      };
      let total = 0;
      for (const bucket of data.data ?? []) {
        for (const r of bucket.results ?? []) {
          total += r.amount?.value ?? 0;
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
          source: 'api',
          windowLabel: 'last 30 days (org costs)',
        }),
      };
    }
  } catch {
    // continue to models probe
  }

  const modelsRes = await fetch('https://api.openai.com/v1/models', {
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
        source: 'api',
        windowLabel: 'key validated · costs unavailable',
        note: 'Use manual entry or an sk-admin key for org costs.',
      }),
    };
  }
  const err = await safeJson(modelsRes);
  return {
    ok: false,
    message: `OpenAI rejected the key (${modelsRes.status}): ${JSON.stringify(err).slice(0, 180)}`,
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
    const starting = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const ending = new Date().toISOString().slice(0, 10);
    const usageRes = await fetch(
      `https://api.anthropic.com/v1/organizations/usage_report/messages?starting_at=${starting}&ending_at=${ending}&bucket_width=1d`,
      { headers },
    );
    if (usageRes.ok) {
      const data = (await safeJson(usageRes)) as {
        data?: Array<{
          usage?: {
            input_tokens?: number;
            output_tokens?: number;
          };
        }>;
      };
      let input = 0;
      let output = 0;
      for (const b of data.data ?? []) {
        input += b.usage?.input_tokens ?? 0;
        output += b.usage?.output_tokens ?? 0;
      }
      return {
        ok: true,
        validated: true,
        snapshot: snap({
          costUsd: null,
          inputTokens: input,
          outputTokens: output,
          totalTokens: input + output,
          source: 'api',
          windowLabel: 'last 30 days (usage report)',
        }),
      };
    }
  } catch {
    // fall through
  }

  // Validate with models list only — never call /messages (would spend tokens).
  try {
    const modelsRes = await fetch('https://api.anthropic.com/v1/models?limit=1', {
      headers,
    });
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
        source: 'unknown',
        windowLabel: 'key saved',
      }),
    };
  } catch (e) {
    return {
      ok: false,
      message: e instanceof Error ? e.message : 'Network error contacting Anthropic',
    };
  }
}

/** xAI / Grok */
async function fetchXai(apiKey: string): Promise<FetchResult> {
  const res = await fetch('https://api.x.ai/v1/models', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const err = await safeJson(res);
    return {
      ok: false,
      message: `xAI rejected the key (${res.status}): ${JSON.stringify(err).slice(0, 180)}`,
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
      source: 'api',
      windowLabel: 'key validated',
    }),
  };
}

/** OpenRouter — excellent first-class usage on the key endpoint. */
async function fetchOpenRouter(apiKey: string): Promise<FetchResult> {
  const res = await fetch('https://openrouter.ai/api/v1/auth/key', {
    headers: { Authorization: `Bearer ${apiKey}` },
  });
  if (!res.ok) {
    const err = await safeJson(res);
    return {
      ok: false,
      message: `OpenRouter error (${res.status}): ${JSON.stringify(err).slice(0, 180)}`,
    };
  }
  const body = (await safeJson(res)) as {
    data?: { usage?: number; limit?: number | null; label?: string };
  };
  const usage = body.data?.usage ?? 0;
  return {
    ok: true,
    validated: true,
    snapshot: snap({
      costUsd: usage,
      inputTokens: null,
      outputTokens: null,
      totalTokens: null,
      source: 'api',
      windowLabel: 'lifetime (OpenRouter key usage)',
      note: body.data?.label,
    }),
  };
}

/** Google AI Studio */
async function fetchGoogle(apiKey: string): Promise<FetchResult> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(apiKey)}`,
  );
  if (!res.ok) {
    const err = await safeJson(res);
    return {
      ok: false,
      message: `Google AI error (${res.status}): ${JSON.stringify(err).slice(0, 180)}`,
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
        source: 'unknown',
        windowLabel: 'manual',
      }),
    };
  }
  const root = baseUrl.replace(/\/$/, '');
  const url = root.endsWith('/v1') ? `${root}/models` : `${root}/v1/models`;
  const headers: Record<string, string> = {};
  if (apiKey) headers.Authorization = `Bearer ${apiKey}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    return {
      ok: false,
      message: `Custom endpoint error (${res.status}) at ${url}`,
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
  switch (kind) {
    case 'openai':
      return fetchOpenAI(apiKey);
    case 'anthropic':
      return fetchAnthropic(apiKey);
    case 'xai':
      return fetchXai(apiKey);
    case 'openrouter':
      return fetchOpenRouter(apiKey);
    case 'google':
      return fetchGoogle(apiKey);
    case 'custom':
      return fetchCustom(apiKey, baseUrl);
    default:
      return { ok: false, message: 'Unknown provider' };
  }
}

export function createManualSnapshot(input: {
  costUsd?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
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
    note: input.note,
    source: 'manual',
    fetchedAt: nowIso(),
    windowLabel: 'manual entry',
  };
}
