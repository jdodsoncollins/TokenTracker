/** Pure brand tokens — no React Native imports (safe for unit tests). */
export const brand = {
  primary: '#7C6CFF',
  primarySoft: 'rgba(124, 108, 255, 0.16)',
  secondary: '#4DB7FF',
  success: '#3DDC97',
  successSoft: 'rgba(61, 220, 151, 0.14)',
  warning: '#FFB020',
  warningSoft: 'rgba(255, 176, 32, 0.14)',
  danger: '#FF6B7A',
  dangerSoft: 'rgba(255, 107, 122, 0.14)',
  privacy: '#3DDC97',
  privacySoft: 'rgba(61, 220, 151, 0.12)',
  providers: {
    openai: '#10A37F',
    anthropic: '#D4A27F',
    xai: '#E8E8E8',
    openrouter: '#6366F1',
    google: '#4285F4',
    custom: '#7C6CFF',
  },
} as const;
