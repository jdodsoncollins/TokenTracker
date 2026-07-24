export type ProviderKind =
  | 'openai'
  | 'anthropic'
  | 'xai'
  | 'openrouter'
  | 'google'
  | 'custom';

export type UsageSource = 'api' | 'manual' | 'unknown';
export type MeasurementKind = 'cumulative' | 'period' | 'point';

/**
 * How usage can be obtained for a provider credential.
 * - full: provider returned costs and/or tokens automatically
 * - validate-only: key works but org/account reports are unavailable (e.g. non-admin OpenAI)
 * - manual-only: provider never exposes auto usage (xAI, Gemini, custom)
 * - none: no credential or validation failed
 */
export type UsageCapability =
  | 'full'
  | 'validate-only'
  | 'manual-only'
  | 'none';

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
  /** Human-readable measurement window. */
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
  /**
   * Last known ability to pull automatic usage for this credential.
   * Derived on fetch; falls back to catalog defaults when unknown.
   */
  usageCapability?: UsageCapability;
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
