import type { ProviderKind } from '../types';

/**
 * Approximate public list prices (USD per 1M tokens).
 * Used only for *estimates* when a provider does not report cost.
 * Rates drift — labels in the UI always say "estimate".
 */
export interface ModelRate {
  id: string;
  label: string;
  /** USD per 1M input tokens */
  inputPerMTok: number;
  /** USD per 1M output tokens */
  outputPerMTok: number;
}

export const MODEL_RATES: Record<string, ModelRate> = {
  'gpt-4o': {
    id: 'gpt-4o',
    label: 'GPT-4o',
    inputPerMTok: 2.5,
    outputPerMTok: 10,
  },
  'gpt-4o-mini': {
    id: 'gpt-4o-mini',
    label: 'GPT-4o mini',
    inputPerMTok: 0.15,
    outputPerMTok: 0.6,
  },
  'o3-mini': {
    id: 'o3-mini',
    label: 'o3-mini',
    inputPerMTok: 1.1,
    outputPerMTok: 4.4,
  },
  'claude-sonnet': {
    id: 'claude-sonnet',
    label: 'Claude Sonnet',
    inputPerMTok: 3,
    outputPerMTok: 15,
  },
  'claude-haiku': {
    id: 'claude-haiku',
    label: 'Claude Haiku',
    inputPerMTok: 0.8,
    outputPerMTok: 4,
  },
  'claude-opus': {
    id: 'claude-opus',
    label: 'Claude Opus',
    inputPerMTok: 15,
    outputPerMTok: 75,
  },
  'grok-3': {
    id: 'grok-3',
    label: 'Grok 3',
    inputPerMTok: 3,
    outputPerMTok: 15,
  },
  'grok-3-mini': {
    id: 'grok-3-mini',
    label: 'Grok 3 mini',
    inputPerMTok: 0.3,
    outputPerMTok: 0.5,
  },
  'gemini-2.0-flash': {
    id: 'gemini-2.0-flash',
    label: 'Gemini 2.0 Flash',
    inputPerMTok: 0.1,
    outputPerMTok: 0.4,
  },
  'gemini-2.5-pro': {
    id: 'gemini-2.5-pro',
    label: 'Gemini 2.5 Pro',
    inputPerMTok: 1.25,
    outputPerMTok: 10,
  },
  'openrouter-blend': {
    id: 'openrouter-blend',
    label: 'OpenRouter blend',
    inputPerMTok: 1,
    outputPerMTok: 3,
  },
  'generic': {
    id: 'generic',
    label: 'Generic mid-tier',
    inputPerMTok: 1,
    outputPerMTok: 3,
  },
};

/** Default estimate model per provider kind. */
export const DEFAULT_MODEL_BY_KIND: Record<ProviderKind, string> = {
  openai: 'gpt-4o-mini',
  anthropic: 'claude-sonnet',
  xai: 'grok-3-mini',
  openrouter: 'openrouter-blend',
  google: 'gemini-2.0-flash',
  custom: 'generic',
};

export function getModelRate(modelId: string): ModelRate {
  return MODEL_RATES[modelId] ?? MODEL_RATES.generic;
}

export function defaultModelForKind(kind: ProviderKind): ModelRate {
  return getModelRate(DEFAULT_MODEL_BY_KIND[kind]);
}

/**
 * Estimate USD cost from token counts.
 * When only total tokens are known, assume a 40% input / 60% output mix
 * (completion-heavy chat workloads).
 */
export function estimateCostFromTokens(input: {
  kind: ProviderKind;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  modelId?: string;
}): { costUsd: number; model: ModelRate; assumedSplit: boolean } {
  const model = input.modelId
    ? getModelRate(input.modelId)
    : defaultModelForKind(input.kind);

  let inTok = input.inputTokens ?? null;
  let outTok = input.outputTokens ?? null;
  let assumedSplit = false;

  if (inTok == null && outTok == null && input.totalTokens != null) {
    inTok = Math.round(input.totalTokens * 0.4);
    outTok = input.totalTokens - inTok;
    assumedSplit = true;
  }

  const cost =
    ((inTok ?? 0) / 1_000_000) * model.inputPerMTok +
    ((outTok ?? 0) / 1_000_000) * model.outputPerMTok;

  return { costUsd: cost, model, assumedSplit };
}

/** Prefer reported cost; otherwise estimate from tokens. */
export function resolveCostUsd(input: {
  kind: ProviderKind;
  costUsd?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  totalTokens?: number | null;
  modelId?: string;
}): {
  value: number | null;
  isEstimate: boolean;
  modelLabel?: string;
} {
  if (input.costUsd != null && !Number.isNaN(input.costUsd)) {
    return { value: input.costUsd, isEstimate: false };
  }
  const hasTokens =
    input.inputTokens != null ||
    input.outputTokens != null ||
    input.totalTokens != null;
  if (!hasTokens) {
    return { value: null, isEstimate: false };
  }
  const est = estimateCostFromTokens(input);
  if (est.costUsd <= 0) {
    return { value: 0, isEstimate: true, modelLabel: est.model.label };
  }
  return {
    value: est.costUsd,
    isEstimate: true,
    modelLabel: est.model.label,
  };
}
