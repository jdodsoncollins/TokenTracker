export const colors = {
  bg: '#0B0F1A',
  bgElevated: '#121826',
  bgCard: '#161D2E',
  bgCardHover: '#1C2538',
  border: '#243049',
  borderSubtle: '#1A2336',

  text: '#F4F7FF',
  textSecondary: '#A8B3C7',
  textMuted: '#6B7790',

  accent: '#7C6CFF',
  accentSoft: 'rgba(124, 108, 255, 0.15)',
  success: '#3DDC97',
  successSoft: 'rgba(61, 220, 151, 0.12)',
  warning: '#FFB020',
  warningSoft: 'rgba(255, 176, 32, 0.12)',
  danger: '#FF6B7A',
  dangerSoft: 'rgba(255, 107, 122, 0.12)',
  info: '#4DB7FF',
  infoSoft: 'rgba(77, 183, 255, 0.12)',

  privacy: '#3DDC97',
  privacySoft: 'rgba(61, 220, 151, 0.1)',

  providers: {
    openai: '#10A37F',
    anthropic: '#D4A27F',
    xai: '#E8E8E8',
    openrouter: '#6366F1',
    google: '#4285F4',
    custom: '#7C6CFF',
  } as const,
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  full: 999,
} as const;
