import type { ProviderDefinition, ProviderKind } from '../../types';
import { brand } from '../../theme/brand';

export const PROVIDER_CATALOG: Record<ProviderKind, ProviderDefinition> = {
  openai: {
    kind: 'openai',
    name: 'OpenAI',
    shortName: 'OpenAI',
    color: brand.providers.openai,
    accent: brand.providers.openai,
    description: 'GPT models and organization usage',
    docsUrl: 'https://platform.openai.com/api-keys',
    keyHint: 'sk-… or sk-admin-… (admin keys can fetch org usage)',
    supportsAutoUsage: true,
    usageHint:
      'An organization admin API key provides 90 days of daily costs and completion tokens. Costs include all billed API capabilities, while token counts cover only the completions usage endpoint. Project keys cannot query organization reports. Adding another admin credential from the same organization duplicates totals; use separate entries for separate organizations.',
  },
  anthropic: {
    kind: 'anthropic',
    name: 'Anthropic',
    shortName: 'Claude',
    color: brand.providers.anthropic,
    accent: brand.providers.anthropic,
    description: 'Claude models',
    docsUrl: 'https://console.anthropic.com/settings/keys',
    keyHint: 'sk-ant-…',
    supportsAutoUsage: true,
    usageHint:
      'An Admin API key provides 90 days of daily message token usage for the account. Standard keys cannot query account reports. Adding another admin credential from the same account duplicates totals; use separate entries for separate accounts.',
  },
  xai: {
    kind: 'xai',
    name: 'xAI (Grok)',
    shortName: 'Grok',
    color: brand.providers.xai,
    accent: '#A0A0A0',
    description: 'Grok models via xAI API',
    docsUrl: 'https://console.x.ai/',
    keyHint: 'xai-…',
    supportsAutoUsage: true,
    usageHint:
      'Validates against the xAI models API. When a usage endpoint is available for your account, auto-refresh will use it; otherwise log a manual snapshot.',
  },
  openrouter: {
    kind: 'openrouter',
    name: 'OpenRouter',
    shortName: 'OpenRouter',
    color: brand.providers.openrouter,
    accent: brand.providers.openrouter,
    description: 'Multi-model gateway with built-in usage',
    docsUrl: 'https://openrouter.ai/keys',
    keyHint: 'sk-or-…',
    supportsAutoUsage: true,
    usageHint: 'Usage (USD) is fetched from OpenRouter’s key info endpoint.',
  },
  google: {
    kind: 'google',
    name: 'Google AI (Gemini)',
    shortName: 'Gemini',
    color: brand.providers.google,
    accent: brand.providers.google,
    description: 'Gemini models via Google AI Studio',
    docsUrl: 'https://aistudio.google.com/apikey',
    keyHint: 'AIza…',
    supportsAutoUsage: false,
    usageHint:
      'Google AI Studio keys validate via model list. Quota/billing lives in Google Cloud — use manual snapshots here.',
  },
  custom: {
    kind: 'custom',
    name: 'Custom / Other',
    shortName: 'Custom',
    color: brand.providers.custom,
    accent: brand.providers.custom,
    description: 'Any OpenAI-compatible endpoint',
    docsUrl: 'https://github.com/jdodsoncollins/TokenTracker',
    keyHint: 'Your API key (optional if endpoint is open)',
    supportsAutoUsage: false,
    usageHint:
      'Point at any OpenAI-compatible base URL. Usage is manual unless the host exposes a known endpoint.',
  },
};

export const PROVIDER_ORDER: ProviderKind[] = [
  'openai',
  'anthropic',
  'xai',
  'openrouter',
  'google',
  'custom',
];
