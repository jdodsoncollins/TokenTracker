import { Platform } from 'react-native';
import { brand } from './brand';

/**
 * Platform design tokens for TokenTracker.
 *
 * iOS  → Apple Human Interface Guidelines + Liquid Glass
 *       https://developer.apple.com/documentation/technologyoverviews/liquid-glass
 *       https://developer.apple.com/design/human-interface-guidelines
 *
 * Android → Material Design 3 + M3 Expressive
 *       https://m3.material.io/
 *
 * Web falls back to a hybrid that leans Liquid Glass (content-first, translucent chrome).
 */

export type PlatformVisual = 'ios' | 'android' | 'web';

export function visualPlatform(): PlatformVisual {
  if (Platform.OS === 'ios') return 'ios';
  if (Platform.OS === 'android') return 'android';
  return 'web';
}

export const isAppleChrome = Platform.OS === 'ios' || Platform.OS === 'web';
export const isMaterialChrome = Platform.OS === 'android';

export { brand };

/**
 * Liquid Glass–inspired palette (iOS / web).
 * Hierarchy through depth & translucency; content stays opaque and high-contrast.
 */
const liquidGlass = {
  bg: '#05070D',
  bgElevated: 'rgba(22, 28, 42, 0.72)',
  bgCard: 'rgba(28, 34, 52, 0.55)',
  bgCardSolid: '#141A28',
  bgCardHover: 'rgba(36, 44, 66, 0.72)',
  /** Floating chrome (tab bar, sheets) */
  glass: 'rgba(18, 24, 38, 0.52)',
  glassStrong: 'rgba(22, 28, 44, 0.78)',
  glassHighlight: 'rgba(255, 255, 255, 0.12)',
  glassBorder: 'rgba(255, 255, 255, 0.14)',
  glassBorderSubtle: 'rgba(255, 255, 255, 0.08)',
  border: 'rgba(255, 255, 255, 0.12)',
  borderSubtle: 'rgba(255, 255, 255, 0.06)',
  text: '#F5F7FF',
  textSecondary: 'rgba(244, 247, 255, 0.72)',
  textMuted: 'rgba(244, 247, 255, 0.48)',
  textOnAccent: '#FFFFFF',
  scrim: 'rgba(0, 0, 0, 0.35)',
  blurIntensity: 48,
  blurTint: 'dark' as const,
  /** Continuous-ish corner radii (HIG-friendly large soft corners) */
  radius: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 22,
    xl: 28,
    full: 999,
  },
  elevation: {
    none: 0,
    card: 0,
    chrome: 0,
    modal: 0,
  },
  shadow: {
    chrome: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.28,
      shadowRadius: 24,
    },
    card: {
      shadowColor: '#7C6CFF',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 16,
    },
  },
  tabBar: {
    floating: true,
    height: 64,
    margin: 12,
    indicator: false,
  },
  ...brand,
  accent: brand.primary,
  accentSoft: brand.primarySoft,
  info: brand.secondary,
  infoSoft: 'rgba(77, 183, 255, 0.14)',
} as const;

/**
 * Material 3 Expressive palette (Android).
 * Tonal surfaces, vibrant containers, shape morph scale, elevation via tone + shadow.
 * https://m3.material.io/
 */
const material3 = {
  bg: '#0E1117',
  /** surface */
  bgElevated: '#161B24',
  /** surface-container */
  bgCard: '#1C2330',
  bgCardSolid: '#1C2330',
  /** surface-container-high */
  bgCardHover: '#232B3B',
  glass: '#1C2330',
  glassStrong: '#232B3B',
  glassHighlight: 'transparent',
  glassBorder: 'rgba(200, 210, 255, 0.12)',
  glassBorderSubtle: 'rgba(200, 210, 255, 0.08)',
  border: 'rgba(200, 210, 255, 0.14)',
  borderSubtle: 'rgba(200, 210, 255, 0.08)',
  text: '#E8EAF2',
  textSecondary: '#B0B7C8',
  textMuted: '#7E8699',
  textOnAccent: '#FFFFFF',
  scrim: 'rgba(0, 0, 0, 0.45)',
  blurIntensity: 0,
  blurTint: 'dark' as const,
  /** M3 shape scale — more expressive, larger on key actions */
  radius: {
    xs: 8,
    sm: 12,
    md: 16,
    lg: 20,
    xl: 28,
    full: 999,
  },
  elevation: {
    none: 0,
    card: 1,
    chrome: 3,
    modal: 6,
  },
  shadow: {
    chrome: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.35,
      shadowRadius: 8,
      elevation: 8,
    },
    card: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.22,
      shadowRadius: 3,
      elevation: 2,
    },
  },
  tabBar: {
    floating: false,
    height: 72,
    margin: 0,
    indicator: true,
  },
  ...brand,
  /** M3 primary more vibrant for expressive hierarchy */
  primary: '#B4A7FF',
  accent: '#B4A7FF',
  accentSoft: 'rgba(180, 167, 255, 0.18)',
  info: '#7EC8FF',
  infoSoft: 'rgba(126, 200, 255, 0.16)',
} as const;

export type ThemeTokens = typeof liquidGlass | typeof material3;

export function getTheme(): ThemeTokens {
  return isMaterialChrome ? material3 : liquidGlass;
}

/** @deprecated Prefer getTheme() — kept for gradual migration */
export const colors = getTheme();

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  /** M3-inspired section gap */
  section: 20,
} as const;

export const radius = getTheme().radius;

export const typography = {
  largeTitle: {
    fontSize: Platform.OS === 'ios' ? 34 : 32,
    fontWeight: '800' as const,
    letterSpacing: Platform.OS === 'ios' ? 0.37 : -0.5,
  },
  title: {
    fontSize: 22,
    fontWeight: '700' as const,
    letterSpacing: 0,
  },
  headline: {
    fontSize: 17,
    fontWeight: '600' as const,
  },
  body: {
    fontSize: 15,
    fontWeight: '400' as const,
    lineHeight: 22,
  },
  callout: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
  },
  caption: {
    fontSize: 12,
    fontWeight: '500' as const,
    letterSpacing: 0.2,
  },
  overline: {
    fontSize: 11,
    fontWeight: '700' as const,
    letterSpacing: Platform.OS === 'ios' ? 1.2 : 0.8,
    textTransform: 'uppercase' as const,
  },
} as const;
