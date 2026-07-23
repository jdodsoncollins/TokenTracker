import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProviderConfig, UsageSnapshot } from '../types';

/**
 * Non-secret local persistence.
 * API keys NEVER go here — only into secureCredentials.
 */

const PROVIDERS_KEY = 'tt_providers_v1';
const HISTORY_KEY = 'tt_usage_history_v1';
// 2,000 entries retain 90 daily buckets for more than 20 provider entries.
const HISTORY_LIMIT = 2_000;
let historyMutation = Promise.resolve();

export interface UsageHistoryEntry {
  providerId: string;
  snapshot: UsageSnapshot;
}

function parseArray(raw: string, label: string): unknown[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error(`Stored ${label} data is corrupted.`);
  }
  if (!Array.isArray(parsed)) {
    throw new Error(`Stored ${label} data is corrupted.`);
  }
  return parsed;
}

function runHistoryMutation<T>(operation: () => Promise<T>): Promise<T> {
  const result = historyMutation.then(operation);
  historyMutation = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

export async function loadProviders(): Promise<ProviderConfig[]> {
  const raw = await AsyncStorage.getItem(PROVIDERS_KEY);
  if (!raw) return [];
  const parsed = parseArray(raw, 'provider');
  // Defense in depth: strip any accidental key fields from older data.
  return parsed.map((value) => {
    if (!value || typeof value !== 'object') {
      throw new Error('Stored provider data is corrupted.');
    }
    const { apiKey: _drop, ...rest } = value as ProviderConfig & {
      apiKey?: string;
    };
    if (typeof rest.id !== 'string' || typeof rest.kind !== 'string') {
      throw new Error('Stored provider data is corrupted.');
    }
    return rest;
  });
}

export async function saveProviders(providers: ProviderConfig[]): Promise<void> {
  // Never persist secrets.
  const safe = providers.map(({ ...p }) => {
    const clone = { ...p } as ProviderConfig & { apiKey?: string };
    delete clone.apiKey;
    return clone as ProviderConfig;
  });
  await AsyncStorage.setItem(PROVIDERS_KEY, JSON.stringify(safe));
}

export async function loadUsageHistory(): Promise<UsageHistoryEntry[]> {
  const raw = await AsyncStorage.getItem(HISTORY_KEY);
  if (!raw) return [];
  return parseArray(raw, 'usage history').map((value) => {
    if (!value || typeof value !== 'object') {
      throw new Error('Stored usage history data is corrupted.');
    }
    const entry = value as UsageHistoryEntry;
    if (
      typeof entry.providerId !== 'string' ||
      !entry.snapshot ||
      typeof entry.snapshot.fetchedAt !== 'string'
    ) {
      throw new Error('Stored usage history data is corrupted.');
    }
    return entry;
  });
}

function historyIdentity(entry: UsageHistoryEntry): string {
  const { snapshot } = entry;
  if (
    snapshot.source === 'api' &&
    snapshot.measurementKind === 'period' &&
    snapshot.periodStart &&
    snapshot.periodEnd
  ) {
    return `${entry.providerId}:period:${snapshot.periodStart}:${snapshot.periodEnd}`;
  }
  return `${entry.providerId}:fetched:${snapshot.fetchedAt}`;
}

function mergeSnapshot(
  refreshed: UsageSnapshot,
  existing: UsageSnapshot,
): UsageSnapshot {
  const inputTokens = refreshed.inputTokens ?? existing.inputTokens;
  const outputTokens = refreshed.outputTokens ?? existing.outputTokens;
  const totalTokens =
    inputTokens != null || outputTokens != null
      ? (inputTokens ?? 0) + (outputTokens ?? 0)
      : (refreshed.totalTokens ?? existing.totalTokens);
  return {
    ...existing,
    ...refreshed,
    costUsd: refreshed.costUsd ?? existing.costUsd,
    inputTokens,
    outputTokens,
    totalTokens,
  };
}

function historyTime(entry: UsageHistoryEntry): number {
  const periodStart = Date.parse(entry.snapshot.periodStart ?? '');
  if (Number.isFinite(periodStart)) return periodStart;
  const fetchedAt = Date.parse(entry.snapshot.fetchedAt);
  return Number.isFinite(fetchedAt) ? fetchedAt : 0;
}

export async function mergeUsageHistory(
  entries: UsageHistoryEntry[],
): Promise<UsageHistoryEntry[]> {
  return runHistoryMutation(async () => {
    const history = await loadUsageHistory();
    const merged = new Map<string, UsageHistoryEntry>();
    for (const entry of history) {
      const identity = historyIdentity(entry);
      if (!merged.has(identity)) merged.set(identity, entry);
    }
    for (const entry of entries) {
      const identity = historyIdentity(entry);
      const existing = merged.get(identity);
      merged.set(
        identity,
        existing
          ? { ...entry, snapshot: mergeSnapshot(entry.snapshot, existing.snapshot) }
          : entry,
      );
    }
    const trimmed = Array.from(merged.values())
      .sort((a, b) => historyTime(b) - historyTime(a))
      .slice(0, HISTORY_LIMIT);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
    return trimmed;
  });
}

export async function appendUsageHistory(
  entry: UsageHistoryEntry,
): Promise<UsageHistoryEntry[]> {
  return mergeUsageHistory([entry]);
}

export async function removeHistoryForProvider(providerId: string): Promise<void> {
  await runHistoryMutation(async () => {
    const history = await loadUsageHistory();
    const next = history.filter((h) => h.providerId !== providerId);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  });
}

export async function clearAllLocalData(): Promise<void> {
  await runHistoryMutation(() =>
    AsyncStorage.multiRemove([PROVIDERS_KEY, HISTORY_KEY]),
  );
}
