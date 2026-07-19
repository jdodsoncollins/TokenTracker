import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { getTheme, isMaterialChrome, spacing } from '../../theme/tokens';

interface Props {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'filled' | 'tonal' | 'outline' | 'danger';
  style?: StyleProp<ViewStyle>;
  icon?: ReactNode;
}

/**
 * iOS: filled capsule (HIG buttons).
 * Android: M3 filled / tonal with expressive corner radius.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
  variant = 'filled',
  style,
  icon,
}: Props) {
  const t = getTheme();
  const isOutline = variant === 'outline';
  const isTonal = variant === 'tonal';
  const isDanger = variant === 'danger';

  const bg =
    isOutline
      ? 'transparent'
      : isTonal
        ? t.accentSoft
        : isDanger
          ? t.dangerSoft
          : t.accent;

  const fg = isOutline
    ? t.accent
    : isTonal
      ? t.accent
      : isDanger
        ? t.danger
        : t.textOnAccent;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      android_ripple={
        isMaterialChrome
          ? { color: 'rgba(255,255,255,0.12)', borderless: false }
          : undefined
      }
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor: isOutline
            ? t.border
            : isDanger
              ? t.danger
              : 'transparent',
          borderWidth: isOutline || isDanger ? 1 : 0,
          borderRadius: isMaterialChrome ? t.radius.xl : t.radius.full,
          opacity: disabled ? 0.5 : pressed && !isMaterialChrome ? 0.88 : 1,
          transform: [{ scale: pressed && !isMaterialChrome ? 0.98 : 1 }],
        },
        style,
      ]}
      accessibilityRole="button"
      accessibilityState={{ disabled: Boolean(disabled || loading) }}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { color: fg }]}>{label}</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: spacing.sm,
  },
  label: {
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
