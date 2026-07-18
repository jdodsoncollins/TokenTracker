import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme/colors';

interface Props {
  onPress?: () => void;
  compact?: boolean;
}

export function PrivacyBanner({ onPress, compact }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.wrap,
        compact && styles.compact,
        pressed && onPress ? styles.pressed : null,
      ]}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel="Privacy: zero usage is ever recorded by TokenTracker"
    >
      <View style={styles.dot} />
      <View style={styles.textCol}>
        <Text style={styles.title}>Zero telemetry. Zero accounts.</Text>
        {!compact && (
          <Text style={styles.body}>
            TokenTracker never records your usage. Keys stay encrypted on this device.
            The only network calls are direct HTTPS to the providers you add.
          </Text>
        )}
        {compact && (
          <Text style={styles.body}>Your data never leaves this device via us.</Text>
        )}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: colors.privacySoft,
    borderColor: 'rgba(61, 220, 151, 0.25)',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  compact: {
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  pressed: {
    opacity: 0.85,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.privacy,
    marginTop: 5,
  },
  textCol: {
    flex: 1,
    gap: 4,
  },
  title: {
    color: colors.privacy,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  body: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
});
