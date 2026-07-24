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
      accessibilityLabel="Privacy: TokenTracker has no backend or telemetry"
    >
      <Surface
        variant="card"
        solid
        padded={false}
        style={{
          borderColor: t.borderSubtle,
          backgroundColor: t.bgCardSolid,
        }}
      >
        <View style={[styles.row, compact && styles.compact]}>
          <View style={[styles.dot, { backgroundColor: t.privacy }]} />
          <View style={styles.textCol}>
            <Text style={[styles.title, { color: t.text }]}>
              Local only · no accounts or telemetry
            </Text>
            {!compact && (
              <Text style={[styles.body, { color: t.textSecondary }]}>
                Keys stay in OS secure storage. Provider calls go directly to the
                provider you select.
              </Text>
            )}
            {compact && (
              <Text style={[styles.body, { color: t.textSecondary }]}>
                TokenTracker receives no usage or credentials.
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
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
  },
  textCol: {
    flex: 1,
    gap: 3,
  },
  title: {
    ...typography.callout,
    fontWeight: '600',
  },
  body: {
    fontSize: 13,
    lineHeight: 18,
  },
});
