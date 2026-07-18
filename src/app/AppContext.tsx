import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ProviderConfig, ProviderKind, UsageSnapshot } from '../types';
import { PROVIDER_CATALOG } from '../services/providers/catalog';
import {
  createManualSnapshot,
  fetchProviderUsage,
} from '../services/providers/fetchUsage';
import {
  deleteCredential,
  getCredential,
  saveCredential,
} from '../services/secureCredentials';
import {
  appendUsageHistory,
  clearAllLocalData,
  loadProviders,
  loadUsageHistory,
  removeHistoryForProvider,
  saveProviders,
  type UsageHistoryEntry,
} from '../services/storage';
import { createId } from '../utils/format';

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
  refreshProvider: (id: string) => Promise<void>;
  refreshAll: () => Promise<void>;
  logManualUsage: (
    id: string,
    input: {
      costUsd?: number | null;
      inputTokens?: number | null;
      outputTokens?: number | null;
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

  useEffect(() => {
    (async () => {
      try {
        const [loaded, hist] = await Promise.all([
          loadProviders(),
          loadUsageHistory(),
        ]);
        setProviders(loaded);
        setHistory(hist);
      } catch (e) {
        setGlobalError(e instanceof Error ? e.message : 'Failed to load local data');
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const persist = useCallback(async (next: ProviderConfig[]) => {
    setProviders(next);
    await saveProviders(next);
  }, []);

  const recordHistory = useCallback(async (entry: UsageHistoryEntry) => {
    await appendUsageHistory(entry);
    setHistory((prev) => [entry, ...prev].slice(0, 500));
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
      const config: ProviderConfig = {
        id,
        kind: input.kind,
        label: input.label.trim() || def.name,
        baseUrl: input.baseUrl?.trim() || undefined,
        createdAt: now,
        updatedAt: now,
        hasCredential: Boolean(input.apiKey.trim()),
        lastUsage: null,
        lastError: null,
      };

      if (input.apiKey.trim()) {
        await saveCredential(id, input.apiKey);
      }

      const next = [config, ...providers];
      await persist(next);

      if (input.apiKey.trim()) {
        try {
          const result = await fetchProviderUsage(
            input.kind,
            input.apiKey.trim(),
            config.baseUrl,
          );
          const updated: ProviderConfig = {
            ...config,
            updatedAt: new Date().toISOString(),
            lastUsage: result.snapshot ?? null,
            lastError: result.ok ? null : result.message ?? 'Refresh failed',
          };
          if (result.snapshot) {
            await recordHistory({ providerId: id, snapshot: result.snapshot });
          }
          await persist(next.map((p) => (p.id === id ? updated : p)));
          return {
            ok: result.ok,
            message: result.message,
          };
        } catch (e) {
          const msg = e instanceof Error ? e.message : 'Network error';
          await persist(
            next.map((p) =>
              p.id === id
                ? { ...p, lastError: msg, updatedAt: new Date().toISOString() }
                : p,
            ),
          );
          return { ok: false, message: msg };
        }
      }

      return { ok: true, message: 'Provider saved (no key — use manual usage).' };
    },
    [persist, providers, recordHistory],
  );

  const removeProvider = useCallback(
    async (id: string) => {
      await deleteCredential(id);
      await removeHistoryForProvider(id);
      setHistory((prev) => prev.filter((h) => h.providerId !== id));
      await persist(providers.filter((p) => p.id !== id));
    },
    [persist, providers],
  );

  const refreshProvider = useCallback(
    async (id: string) => {
      const provider = providers.find((p) => p.id === id);
      if (!provider) return;
      setRefreshingId(id);
      setGlobalError(null);
      try {
        const key = await getCredential(id);
        if (!key) {
          await persist(
            providers.map((p) =>
              p.id === id
                ? {
                    ...p,
                    lastError:
                      'No credential stored. Update the API key or log usage manually.',
                    updatedAt: new Date().toISOString(),
                  }
                : p,
            ),
          );
          return;
        }
        const result = await fetchProviderUsage(provider.kind, key, provider.baseUrl);
        const nextUsage: UsageSnapshot | null =
          result.snapshot ?? provider.lastUsage ?? null;
        if (result.snapshot) {
          await recordHistory({ providerId: id, snapshot: result.snapshot });
        }
        await persist(
          providers.map((p) =>
            p.id === id
              ? {
                  ...p,
                  lastUsage: nextUsage,
                  lastError: result.ok ? null : result.message ?? 'Refresh failed',
                  updatedAt: new Date().toISOString(),
                  hasCredential: true,
                }
              : p,
          ),
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Refresh failed';
        await persist(
          providers.map((p) =>
            p.id === id
              ? { ...p, lastError: msg, updatedAt: new Date().toISOString() }
              : p,
          ),
        );
      } finally {
        setRefreshingId(null);
      }
    },
    [persist, providers, recordHistory],
  );

  const refreshAll = useCallback(async () => {
    for (const p of providers) {
      // eslint-disable-next-line no-await-in-loop
      await refreshProvider(p.id);
    }
  }, [providers, refreshProvider]);

  const logManualUsage = useCallback(
    async (
      id: string,
      input: {
        costUsd?: number | null;
        inputTokens?: number | null;
        outputTokens?: number | null;
        note?: string;
      },
    ) => {
      const snapshot = createManualSnapshot(input);
      await recordHistory({ providerId: id, snapshot });
      await persist(
        providers.map((p) =>
          p.id === id
            ? {
                ...p,
                lastUsage: snapshot,
                lastError: null,
                updatedAt: new Date().toISOString(),
              }
            : p,
        ),
      );
    },
    [persist, providers, recordHistory],
  );

  const updateCredential = useCallback(
    async (id: string, apiKey: string) => {
      await saveCredential(id, apiKey);
      await persist(
        providers.map((p) =>
          p.id === id
            ? { ...p, hasCredential: true, updatedAt: new Date().toISOString() }
            : p,
        ),
      );
    },
    [persist, providers],
  );

  const wipeEverything = useCallback(async () => {
    for (const p of providers) {
      // eslint-disable-next-line no-await-in-loop
      await deleteCredential(p.id);
    }
    await clearAllLocalData();
    setProviders([]);
    setHistory([]);
  }, [providers]);

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
