import { StyleSheet, Text, View } from 'react-native';
import { getTheme, spacing, typography } from '../theme/tokens';
import { Surface } from './ui/Surface';

interface Props {
  label: string;
  value: string;
  hint?: string;
  accent?: string;
}

export function StatCard({ label, value, hint, accent }: Props) {
  const t = getTheme();
  const bar = accent ?? t.accent;

  return (
    <Surface variant="card" style={styles.flex} padded={false}>
      <View style={styles.inner}>
        <View style={[styles.bar, { backgroundColor: bar }]} />
        <Text style={[styles.label, { color: t.textMuted }]}>{label}</Text>
        <Text
          style={[styles.value, { color: t.text }]}
          numberOfLines={1}
          adjustsFontSizeToFit
        >
          {value}
        </Text>
        {hint ? (
          <Text style={[styles.hint, { color: t.textSecondary }]}>{hint}</Text>
        ) : null}
      </View>
    </Surface>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    minWidth: 140,
  },
  inner: {
    padding: spacing.lg,
    overflow: 'hidden',
  },
  bar: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
  label: {
    ...typography.overline,
    marginBottom: 6,
    marginLeft: 6,
  },
  value: {
    fontSize: 26,
    fontWeight: '700',
    letterSpacing: -0.5,
    marginLeft: 6,
  },
  hint: {
    fontSize: 12,
    marginTop: 6,
    marginLeft: 6,
  },
});
