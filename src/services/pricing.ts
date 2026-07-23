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

const MODEL_IDS_BY_KIND: Record<ProviderKind, string[]> = {
  openai: ['gpt-4o', 'gpt-4o-mini', 'o3-mini'],
  anthropic: ['claude-sonnet', 'claude-haiku', 'claude-opus'],
  xai: ['grok-3', 'grok-3-mini'],
  openrouter: [
    'openrouter-blend',
    'gpt-4o',
    'gpt-4o-mini',
    'o3-mini',
    'claude-sonnet',
    'claude-haiku',
    'claude-opus',
    'grok-3',
    'grok-3-mini',
    'gemini-2.0-flash',
    'gemini-2.5-pro',
  ],
  google: ['gemini-2.0-flash', 'gemini-2.5-pro'],
  custom: ['generic'],
};

export function getModelRate(modelId: string): ModelRate | null {
  return MODEL_RATES[modelId] ?? null;
}

export function modelRatesForProvider(kind: ProviderKind): ModelRate[] {
  return MODEL_IDS_BY_KIND[kind].map((id) => MODEL_RATES[id]);
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
  modelId: string;
}): { costUsd: number; model: ModelRate; assumedSplit: boolean } {
  const model = getModelRate(input.modelId);
  if (!model) throw new Error(`Unknown pricing model: ${input.modelId}`);

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
  if (input.costUsd != null) {
    return Number.isFinite(input.costUsd) && input.costUsd >= 0
      ? { value: input.costUsd, isEstimate: false }
      : { value: null, isEstimate: false };
  }
  const hasTokens =
    input.inputTokens != null ||
    input.outputTokens != null ||
    input.totalTokens != null;
  if (!hasTokens) {
    return { value: null, isEstimate: false };
  }
  const modelId = input.modelId;
  if (!modelId || !getModelRate(modelId)) {
    return { value: null, isEstimate: false };
  }
  const est = estimateCostFromTokens({ ...input, modelId });
  if (est.costUsd <= 0) {
    return { value: 0, isEstimate: true, modelLabel: est.model.label };
  }
  return {
    value: est.costUsd,
    isEstimate: true,
    modelLabel: est.model.label,
  };
}

export interface ManualUsageFormInput {
  costUsd: string;
  inputTokens: string;
  outputTokens: string;
  modelId: string;
}

export type ValidManualUsage = {
  costUsd: number | null;
  inputTokens: number | null;
  outputTokens: number | null;
  modelId?: string;
};

/** Parse manual form values without allowing NaN, infinity, negatives, or fractions. */
export function validateManualUsageInput(
  input: ManualUsageFormInput,
): { value?: ValidManualUsage; error?: string } {
  const costText = input.costUsd.trim();
  const inputText = input.inputTokens.trim();
  const outputText = input.outputTokens.trim();

  if (!costText && !inputText && !outputText) {
    return { error: 'Enter a cost or at least one token count.' };
  }

  const costUsd = costText ? Number(costText) : null;
  if (costUsd != null && (!Number.isFinite(costUsd) || costUsd < 0)) {
    return { error: 'Cost must be a finite, nonnegative number.' };
  }

  const parseTokens = (text: string): number | null =>
    text ? Number(text) : null;
  const inputTokens = parseTokens(inputText);
  const outputTokens = parseTokens(outputText);
  if (
    [inputTokens, outputTokens].some(
      (value) =>
        value != null &&
        (!Number.isFinite(value) || value < 0 || !Number.isInteger(value)),
    )
  ) {
    return { error: 'Token counts must be finite, nonnegative whole numbers.' };
  }

  const needsEstimate = costUsd == null && (inputTokens != null || outputTokens != null);
  if (needsEstimate && !input.modelId) {
    return { error: 'Select a pricing model to estimate token cost.' };
  }
  if (input.modelId && !getModelRate(input.modelId)) {
    return { error: 'Select a valid pricing model.' };
  }

  return {
    value: {
      costUsd,
      inputTokens,
      outputTokens,
      modelId: needsEstimate ? input.modelId : undefined,
    },
  };
}
