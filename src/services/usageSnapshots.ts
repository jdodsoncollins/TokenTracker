import type { ProviderConfig, UsageSnapshot } from '../types';
import type { UsageHistoryEntry } from './storage';

export function hasUsageMetrics(
  snapshot: UsageSnapshot | null | undefined,
): snapshot is UsageSnapshot {
  if (!snapshot) return false;
  return [
    snapshot.costUsd,
    snapshot.inputTokens,
    snapshot.outputTokens,
    snapshot.totalTokens,
  ].some((value) => value != null && Number.isFinite(value) && value >= 0);
}

export function restoreLatestUsage(
  providers: ProviderConfig[],
  history: UsageHistoryEntry[],
): ProviderConfig[] {
  return providers.map((provider) => {
    if (hasUsageMetrics(provider.lastUsage)) return provider;
    const latest = history.find(
      (entry) =>
        entry.providerId === provider.id && hasUsageMetrics(entry.snapshot),
    )?.snapshot;
    return latest ? { ...provider, lastUsage: latest } : provider;
  });
}
