import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProviderConfig, UsageSnapshot } from '../types';

/**
 * Non-secret local persistence.
 * API keys NEVER go here — only into secureCredentials.
 */

const PROVIDERS_KEY = 'tt_providers_v1';
const HISTORY_KEY = 'tt_usage_history_v1';
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

export async function appendUsageHistory(entry: UsageHistoryEntry): Promise<void> {
  await runHistoryMutation(async () => {
    const history = await loadUsageHistory();
    history.unshift(entry);
    // Cap local history so the device stays lean.
    const trimmed = history.slice(0, 500);
    await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  });
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
