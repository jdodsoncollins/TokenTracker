import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing } from '../theme/colors';

interface Props {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}

export function StatCard({ label, value, hint, accent = colors.accent }: Props) {
  return (
    <View style={styles.card}>
      <View style={[styles.bar, { backgroundColor: accent }]} />
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.value} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 140,
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    overflow: 'hidden',
  },
  bar: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 3,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  value: {
    color: colors.text,
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: 12,
    marginTop: 6,
  },
});
