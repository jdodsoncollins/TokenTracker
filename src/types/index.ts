export type ProviderKind =
  | 'openai'
  | 'anthropic'
  | 'xai'
  | 'openrouter'
  | 'google'
  | 'custom';

export type UsageSource = 'api' | 'manual' | 'unknown';
export type MeasurementKind = 'cumulative' | 'period' | 'point';

export interface UsageSnapshot {
  /** Estimated or reported spend in USD for the current window. */
  costUsd: number | null;
  /** Prompt / input tokens when known. */
  inputTokens: number | null;
  /** Completion / output tokens when known. */
  outputTokens: number | null;
  /** Total tokens when known. */
  totalTokens: number | null;
  /** Optional free-form note (e.g. "March 2026 MTD"). */
  note?: string;
  /** Missing on legacy data means unknown, never cumulative. */
  measurementKind?: MeasurementKind;
  /** ISO boundaries for period readings or bounded cumulative readings. */
  periodStart?: string;
  periodEnd?: string;
  /** Explicit pricing model used when cost is estimated from tokens. */
  modelId?: string;
  source: UsageSource;
  fetchedAt: string;
  /** Human-readable window, e.g. "last 30 days". */
  windowLabel?: string;
}

export interface ProviderConfig {
  id: string;
  kind: ProviderKind;
  /** Display name chosen by the user. */
  label: string;
  /** Optional custom base URL (custom / proxies). */
  baseUrl?: string;
  createdAt: string;
  updatedAt: string;
  lastUsage?: UsageSnapshot | null;
  lastError?: string | null;
  /** Key is stored separately in SecureStore — never in this object. */
  hasCredential: boolean;
}

export interface ProviderDefinition {
  kind: ProviderKind;
  name: string;
  shortName: string;
  color: string;
  accent: string;
  description: string;
  docsUrl: string;
  /** Hint shown when adding a key. */
  keyHint: string;
  supportsAutoUsage: boolean;
  usageHint: string;
}

export type TabId = 'dashboard' | 'providers' | 'privacy';
