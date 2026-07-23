import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { getTheme, isAppleChrome, spacing } from '../../theme/tokens';

type SurfaceVariant = 'card' | 'chrome' | 'inset' | 'plain';

interface Props {
  children: ReactNode;
  variant?: SurfaceVariant;
  style?: StyleProp<ViewStyle>;
  /** Skip blur even on Apple platforms (dense content). */
  solid?: boolean;
  padded?: boolean;
}

/**
 * Platform surface primitive.
 * - iOS/web: Liquid Glass–style translucent panel with rim highlight (HIG).
 * - Android: Material 3 tonal surface-container with soft elevation.
 */
export function Surface({
  children,
  variant = 'card',
  style,
  solid = false,
  padded = true,
}: Props) {
  const t = getTheme();
  const useGlass = isAppleChrome && !solid && variant !== 'plain';

  const radius =
    variant === 'chrome'
      ? t.radius.xl
      : variant === 'inset'
        ? t.radius.md
        : t.radius.lg;

  const baseStyle: ViewStyle = {
    borderRadius: radius,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    borderColor:
      variant === 'inset' ? t.borderSubtle : useGlass ? t.glassBorder : t.border,
    backgroundColor: useGlass
      ? variant === 'chrome'
        ? t.glass
        : t.bgCard
      : variant === 'inset'
        ? t.bgElevated
        : t.bgCardSolid,
    ...(variant === 'chrome' ? t.shadow.chrome : t.shadow.card),
  };

  const body = padded ? (
    <View style={styles.padded}>{children}</View>
  ) : (
    children
  );

  if (useGlass && Platform.OS === 'ios') {
    return (
      <View style={[baseStyle, styles.glassOuter, style]}>
        <BlurView
          intensity={t.blurIntensity}
          tint={t.blurTint}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(255,255,255,0.18)', 'rgba(255,255,255,0.02)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.4, y: 1 }}
          style={styles.specular}
          pointerEvents="none"
        />
        <View
          style={[styles.glassInnerBorder, { borderRadius: radius }]}
          pointerEvents="none"
        />
        {body}
      </View>
    );
  }

  if (useGlass && Platform.OS === 'web') {
    return (
      <View
        style={[
          baseStyle,
          styles.glassOuter,
          // @ts-expect-error web-only backdrop filter
          { backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' },
          style,
        ]}
      >
        <LinearGradient
          colors={['rgba(255,255,255,0.14)', 'rgba(255,255,255,0.02)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={styles.specular}
          pointerEvents="none"
        />
        {body}
      </View>
    );
  }

  return <View style={[baseStyle, style]}>{body}</View>;
}

const styles = StyleSheet.create({
  padded: {
    padding: spacing.lg,
  },
  glassOuter: {
    position: 'relative',
  },
  specular: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  glassInnerBorder: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
});
