import { Pressable, StyleSheet, Text, View } from 'react-native';
import { getTheme, spacing, typography } from '../theme/tokens';
import { Surface } from './ui/Surface';

interface Props {
  onPress?: () => void;
  compact?: boolean;
}

export function PrivacyBanner({ onPress, compact }: Props) {
  const t = getTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole={onPress ? 'button' : 'text'}
      accessibilityLabel="Privacy: zero usage is ever recorded by TokenTracker"
    >
      <Surface
        variant="card"
        solid
        padded={false}
        style={{
          borderColor: 'rgba(61, 220, 151, 0.28)',
          backgroundColor: t.privacySoft,
        }}
      >
        <View style={[styles.row, compact && styles.compact]}>
          <View style={[styles.dot, { backgroundColor: t.privacy }]} />
          <View style={styles.textCol}>
            <Text style={[styles.title, { color: t.privacy }]}>
              Zero telemetry. Zero accounts.
            </Text>
            {!compact && (
              <Text style={[styles.body, { color: t.textSecondary }]}>
                TokenTracker never records your usage. Keys stay encrypted on this
                device. The only network calls are direct HTTPS to the providers you
                add.
              </Text>
            )}
            {compact && (
              <Text style={[styles.body, { color: t.textSecondary }]}>
                Your data never leaves this device via us.
              </Text>
            )}
          </View>
        </View>
      </Surface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
  },
  compact: {
    paddingVertical: spacing.md,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  textCol: {
    flex: 1,
    gap: 4,
  },
  title: {
    ...typography.callout,
    fontWeight: '700',
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
});
