import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type {
  ProviderConfig,
  ProviderKind,
  UsageCapability,
  UsageSnapshot,
} from '../types';
import { PROVIDER_CATALOG } from '../services/providers/catalog';
import {
  createManualSnapshot,
  fetchProviderUsage,
  type FetchResult,
} from '../services/providers/fetchUsage';
import {
  deleteCredential,
  getCredential,
  migrateCredentialStorage,
  saveCredential,
  wipeAllCredentials,
} from '../services/secureCredentials';
import {
  clearAllLocalData,
  loadProviders,
  loadUsageHistory,
  mergeUsageHistory,
  removeHistoryForProvider,
  saveProviders,
  type UsageHistoryEntry,
} from '../services/storage';
import { createId } from '../utils/format';
import {
  hasUsageMetrics,
  restoreLatestUsage,
} from '../services/usageSnapshots';

const ALWAYS_MANUAL: ProviderKind[] = ['xai', 'google', 'custom'];

function capabilityFromFetch(
  kind: ProviderKind,
  result: FetchResult,
): UsageCapability {
  if (!result.ok && !result.validated) return 'none';
  if (ALWAYS_MANUAL.includes(kind)) return 'manual-only';
  if (hasUsageMetrics(result.snapshot) || (result.history && result.history.length > 0)) {
    return 'full';
  }
  if (result.validated || result.ok) {
    return PROVIDER_CATALOG[kind].supportsAutoUsage ? 'validate-only' : 'manual-only';
  }
  return 'none';
}

interface AppState {
  ready: boolean;
  providers: ProviderConfig[];
  history: UsageHistoryEntry[];
  refreshingId: string | null;
  globalError: string | null;
  addProvider: (input: {
    kind: ProviderKind;
    label: string;
    apiKey: string;
    baseUrl?: string;
  }) => Promise<{ ok: boolean; message?: string }>;
  removeProvider: (id: string) => Promise<void>;
  refreshProvider: (id: string) => Promise<{ ok: boolean; message?: string }>;
  refreshAll: () => Promise<void>;
  logManualUsage: (
    id: string,
    input: {
      costUsd?: number | null;
      inputTokens?: number | null;
      outputTokens?: number | null;
      modelId?: string;
      measurementKind?: UsageSnapshot['measurementKind'];
      note?: string;
    },
  ) => Promise<void>;
  updateCredential: (id: string, apiKey: string) => Promise<void>;
  wipeEverything: () => Promise<void>;
  totals: {
    costUsd: number;
    tokens: number;
    withCost: number;
    withTokens: number;
  };
}

const Ctx = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [providers, setProviders] = useState<ProviderConfig[]>([]);
  const [history, setHistory] = useState<UsageHistoryEntry[]>([]);
  const [refreshingId, setRefreshingId] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const providersRef = useRef<ProviderConfig[]>([]);
  const providerPersistenceRef = useRef(Promise.resolve());

  useEffect(() => {
    (async () => {
      try {
        const [loaded, hist] = await Promise.all([
          loadProviders(),
          loadUsageHistory(),
        ]);
        await migrateCredentialStorage(
          loaded.filter((provider) => provider.hasCredential).map((provider) => provider.id),
        );
        const restored = restoreLatestUsage(loaded, hist);
        providersRef.current = restored;
        setProviders(restored);
        setHistory(hist);
        if (restored.some((provider, index) => provider !== loaded[index])) {
          await saveProviders(restored);
        }
      } catch (e) {
        setGlobalError(e instanceof Error ? e.message : 'Failed to load local data');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const updateProviders = useCallback(
    async (update: (current: ProviderConfig[]) => ProviderConfig[]) => {
      const next = update(providersRef.current);
      providersRef.current = next;
      setProviders(next);
      const persistence = providerPersistenceRef.current.then(() =>
        saveProviders(next),
      );
      providerPersistenceRef.current = persistence.catch(() => undefined);
      await persistence;
    },
    [],
  );

  const recordHistory = useCallback(async (entries: UsageHistoryEntry[]) => {
    const merged = await mergeUsageHistory(entries);
    setHistory(merged);
  }, []);

  const addProvider = useCallback(
    async (input: {
      kind: ProviderKind;
      label: string;
      apiKey: string;
      baseUrl?: string;
    }) => {
      const id = createId();
      const now = new Date().toISOString();
      const def = PROVIDER_CATALOG[input.kind];
      const hasKey = Boolean(input.apiKey.trim());
      const config: ProviderConfig = {
        id,
        kind: input.kind,
        label: input.label.trim() || def.name,
        baseUrl: input.baseUrl?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
        hasCredential: hasKey,
        lastUsage: null,
        lastError: null,
        usageCapability: hasKey
          ? ALWAYS_MANUAL.includes(input.kind)
            ? 'manual-only'
            : undefined
          : 'none',
      };

      if (hasKey) {
        await saveCredential(id, input.apiKey);
      }

      await updateProviders((current) => [config, ...current]);

      if (hasKey) {
        try {
          const result = await fetchProviderUsage(
            input.kind,
            input.apiKey.trim(),
            config.baseUrl,
          );
          if (result.history !== undefined) {
            await recordHistory(
              result.history.map((snapshot) => ({ providerId: id, snapshot })),
            );
          } else if (hasUsageMetrics(result.snapshot)) {
            await recordHistory([{ providerId: id, snapshot: result.snapshot! }]);
          }
          const capability = capabilityFromFetch(input.kind, result);
          await updateProviders((current) =>
            current.map((p) =>
              p.id === id
                ? {
                    ...p,
                    updatedAt: new Date().toISOString(),
                    lastUsage: hasUsageMetrics(result.snapshot)
                      ? result.snapshot ?? null
                      : p.lastUsage ?? null,
                    lastError: result.ok
                      ? null
                      : result.message ?? 'Refresh failed',
                    usageCapability: capability,
                    hasCredential: true,
                  }
                : p,
            ),
          );
          return {
            ok: result.ok,
            message: result.message,
          };
        } catch {
          const msg = 'Network error';
          await updateProviders((current) =>
            current.map((p) =>
              p.id === id
                ? {
                    ...p,
                    lastError: msg,
                    usageCapability: 'none',
                    updatedAt: new Date().toISOString(),
                  }
                : p,
            ),
          );
          return { ok: false, message: msg };
        }
      }

      return { ok: true, message: 'Provider saved (no key — use manual usage).' };
    },
    [recordHistory, updateProviders],
  );

  const removeProvider = useCallback(
    async (id: string) => {
      await deleteCredential(id);
      await removeHistoryForProvider(id);
      setHistory((prev) => prev.filter((h) => h.providerId !== id));
      await updateProviders((current) => current.filter((p) => p.id !== id));
    },
    [updateProviders],
  );

  const refreshProvider = useCallback(
    async (id: string) => {
      const provider = providersRef.current.find((p) => p.id === id);
      if (!provider) return { ok: false, message: 'Provider not found.' };
      setRefreshingId(id);
      setGlobalError(null);
      try {
        const key = await getCredential(id);
        if (!key) {
          await updateProviders((current) =>
            current.map((p) =>
              p.id === id
                ? {
                    ...p,
                    lastError:
                      'No credential stored. Update the API key or log usage manually.',
                    usageCapability: 'none',
                    updatedAt: new Date().toISOString(),
                  }
                : p,
            ),
          );
          return { ok: false, message: 'No credential stored.' };
        }
        const result = await fetchProviderUsage(provider.kind, key, provider.baseUrl);
        if (result.history !== undefined) {
          await recordHistory(
            result.history.map((snapshot) => ({ providerId: id, snapshot })),
          );
        } else if (hasUsageMetrics(result.snapshot)) {
          await recordHistory([{ providerId: id, snapshot: result.snapshot! }]);
        }
        const capability = capabilityFromFetch(provider.kind, result);
        await updateProviders((current) =>
          current.map((p) =>
            p.id === id
              ? {
                  ...p,
                  lastUsage: hasUsageMetrics(result.snapshot)
                    ? result.snapshot ?? null
                    : p.lastUsage ?? null,
                  lastError: result.ok ? null : result.message ?? 'Refresh failed',
                  updatedAt: new Date().toISOString(),
                  hasCredential: true,
                  usageCapability: capability,
                }
              : p,
          ),
        );
        return { ok: result.ok, message: result.message };
      } catch {
        const msg = 'Refresh failed';
        await updateProviders((current) =>
          current.map((p) =>
            p.id === id
              ? { ...p, lastError: msg, updatedAt: new Date().toISOString() }
              : p,
          ),
        );
        return { ok: false, message: msg };
      } finally {
        setRefreshingId(null);
      }
    },
    [recordHistory, updateProviders],
  );

  const refreshAll = useCallback(async () => {
    const ids = providersRef.current.map((provider) => provider.id);
    for (const id of ids) {
      // eslint-disable-next-line no-await-in-loop
      await refreshProvider(id);
    }
  }, [refreshProvider]);

  const logManualUsage = useCallback(
    async (
      id: string,
      input: {
        costUsd?: number | null;
        inputTokens?: number | null;
        outputTokens?: number | null;
        modelId?: string;
        measurementKind?: UsageSnapshot['measurementKind'];
        note?: string;
      },
    ) => {
      const snapshot = createManualSnapshot(input);
      await recordHistory([{ providerId: id, snapshot }]);
      await updateProviders((current) =>
        current.map((p) =>
          p.id === id
            ? {
                ...p,
                lastUsage: snapshot,
                lastError: null,
                updatedAt: new Date().toISOString(),
                // Keep existing capability; manual entry doesn't upgrade to full auto
              }
            : p,
        ),
      );
    },
    [recordHistory, updateProviders],
  );

  const updateCredential = useCallback(
    async (id: string, apiKey: string) => {
      await saveCredential(id, apiKey);
      await updateProviders((current) =>
        current.map((p) =>
          p.id === id
            ? { ...p, hasCredential: true, updatedAt: new Date().toISOString() }
            : p,
        ),
      );
    },
    [updateProviders],
  );

  const wipeEverything = useCallback(async () => {
    await wipeAllCredentials(providersRef.current.map((provider) => provider.id));
    await updateProviders(() => []);
    await clearAllLocalData();
    setHistory([]);
  }, [updateProviders]);

  const totals = useMemo(() => {
    let costUsd = 0;
    let tokens = 0;
    let withCost = 0;
    let withTokens = 0;
    for (const p of providers) {
      const u = p.lastUsage;
      if (!u) continue;
      if (u.costUsd != null) {
        costUsd += u.costUsd;
        withCost += 1;
      }
      if (u.totalTokens != null) {
        tokens += u.totalTokens;
        withTokens += 1;
      } else if (u.inputTokens != null || u.outputTokens != null) {
        tokens += (u.inputTokens ?? 0) + (u.outputTokens ?? 0);
        withTokens += 1;
      }
    }
    return { costUsd, tokens, withCost, withTokens };
  }, [providers]);

  const value = useMemo(
    () => ({
      ready,
      providers,
      history,
      refreshingId,
      globalError,
      addProvider,
      removeProvider,
      refreshProvider,
      refreshAll,
      logManualUsage,
      updateCredential,
      wipeEverything,
      totals,
    }),
    [
      ready,
      providers,
      history,
      refreshingId,
      globalError,
      addProvider,
      removeProvider,
      refreshProvider,
      refreshAll,
      logManualUsage,
      updateCredential,
      wipeEverything,
      totals,
    ],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp(): AppState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
