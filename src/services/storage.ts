import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ProviderConfig, UsageSnapshot } from '../types';

/**
 * Non-secret local persistence.
 * API keys NEVER go here — only into secureCredentials.
 */

const PROVIDERS_KEY = 'tt_providers_v1';
const HISTORY_KEY = 'tt_usage_history_v1';

export interface UsageHistoryEntry {
  providerId: string;
  snapshot: UsageSnapshot;
}

export async function loadProviders(): Promise<ProviderConfig[]> {
  const raw = await AsyncStorage.getItem(PROVIDERS_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as ProviderConfig[];
    // Defense in depth: strip any accidental key fields from older data.
    return parsed.map((p) => {
      const { apiKey: _drop, ...rest } = p as ProviderConfig & { apiKey?: string };
      return rest;
    });
  } catch {
    return [];
  }
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
  try {
    return JSON.parse(raw) as UsageHistoryEntry[];
  } catch {
    return [];
  }
}

export async function appendUsageHistory(entry: UsageHistoryEntry): Promise<void> {
  const history = await loadUsageHistory();
  history.unshift(entry);
  // Cap local history so the device stays lean.
  const trimmed = history.slice(0, 500);
  await AsyncStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

export async function clearAllLocalData(): Promise<void> {
  await AsyncStorage.multiRemove([PROVIDERS_KEY, HISTORY_KEY]);
}
