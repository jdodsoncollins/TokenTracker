import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { getTheme, isAppleChrome, spacing } from '../../theme/tokens';

interface Props {
  children: ReactNode;
  scroll?: boolean;
  /** Extra bottom pad for floating tab bar / keyboard */
  bottomPad?: number;
  style?: StyleProp<ViewStyle>;
  contentStyle?: StyleProp<ViewStyle>;
  keyboard?: boolean;
}

/**
 * Edge-to-edge content canvas (Apple: content-first; M3: surface canvas).
 * Soft ambient gradient on Apple chrome suggests environment behind glass.
 */
export function Screen({
  children,
  scroll = true,
  bottomPad = 120,
  style,
  contentStyle,
  keyboard = false,
}: Props) {
  const insets = useSafeAreaInsets();
  const t = getTheme();

  const body = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[
        styles.content,
        {
          paddingTop: insets.top + spacing.lg,
          paddingBottom: bottomPad + Math.max(insets.bottom, 8),
        },
        contentStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View
      style={[
        styles.flex,
        styles.content,
        {
          paddingTop: insets.top + spacing.lg,
          paddingBottom: bottomPad + Math.max(insets.bottom, 8),
        },
        contentStyle,
      ]}
    >
      {children}
    </View>
  );

  const wrapped = keyboard ? (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {body}
    </KeyboardAvoidingView>
  ) : (
    body
  );

  return (
    <View style={[styles.root, { backgroundColor: t.bg }, style]}>
      {isAppleChrome ? (
        <LinearGradient
          colors={['#12182A', t.bg, '#0A0E18']}
          locations={[0, 0.35, 1]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : (
        <LinearGradient
          colors={['#151B28', t.bg]}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      )}
      {/* Soft brand glow — content focus stays center; chrome picks up color on glass */}
      <LinearGradient
        colors={
          isAppleChrome
            ? ['rgba(124,108,255,0.18)', 'transparent']
            : ['rgba(180,167,255,0.12)', 'transparent']
        }
        style={styles.glow}
        pointerEvents="none"
      />
      {wrapped}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  glow: {
    position: 'absolute',
    top: -40,
    left: -20,
    right: -20,
    height: 220,
  },
});
