import type { ProviderConfig, ProviderKind, UsageCapability } from '../types';
import { PROVIDER_CATALOG } from './providers/catalog';
import { hasUsageMetrics } from './usageSnapshots';

/** Providers that never expose automatic org/account usage via public API. */
const ALWAYS_MANUAL: ProviderKind[] = ['xai', 'google', 'custom'];

/**
 * Resolve how usage can be obtained for a provider given its last known state.
 * Prefers the stored capability from the last fetch; otherwise falls back to
 * catalog + whether metrics exist.
 */
export function resolveUsageCapability(
  provider: ProviderConfig,
): UsageCapability {
  if (provider.usageCapability) return provider.usageCapability;

  if (!provider.hasCredential) return 'none';

  if (ALWAYS_MANUAL.includes(provider.kind)) return 'manual-only';

  if (hasUsageMetrics(provider.lastUsage)) return 'full';

  // Key present, no metrics, and provider supports auto → likely validate-only
  if (PROVIDER_CATALOG[provider.kind].supportsAutoUsage) {
    return 'validate-only';
  }

  return 'manual-only';
}

export function capabilityStatusLabel(capability: UsageCapability): string {
  switch (capability) {
    case 'full':
      return 'Auto usage';
    case 'validate-only':
      return 'Validated · Manual entry';
    case 'manual-only':
      return 'Manual entry';
    case 'none':
      return 'No key';
  }
}

export function capabilityExplainer(
  kind: ProviderKind,
  capability: UsageCapability,
): string | null {
  if (capability === 'full' || capability === 'none') return null;

  if (kind === 'openai' && capability === 'validate-only') {
    return (
      'This key works for models but cannot read organization costs. ' +
      'OpenAI only exposes cost and completion history to organization admin keys. ' +
      'Log a manual snapshot below, or replace this key with an admin key.'
    );
  }

  if (kind === 'anthropic' && capability === 'validate-only') {
    return (
      'This key works for models but cannot read account usage reports. ' +
      'Anthropic requires an Admin API key for automatic history. ' +
      'Log a manual snapshot below, or replace this key with an admin key.'
    );
  }

  if (capability === 'manual-only' || capability === 'validate-only') {
    return PROVIDER_CATALOG[kind].usageHint;
  }

  return null;
}

export function supportsAutoRefresh(capability: UsageCapability): boolean {
  return capability === 'full';
}
