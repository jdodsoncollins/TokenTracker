import { StyleSheet, Text, View } from 'react-native';
import { getTheme, spacing, typography } from '../theme/tokens';

interface Props {
  title: string;
  body: string;
}

export function EmptyState({ title, body }: Props) {
  const t = getTheme();
  return (
    <View style={styles.wrap}>
      <View style={[styles.iconRing, { borderColor: t.border, backgroundColor: t.bgElevated }]}>
        <Text style={[styles.emoji, { color: t.textMuted }]}>○</Text>
      </View>
      <Text style={[styles.title, { color: t.text }]}>{title}</Text>
      <Text style={[styles.body, { color: t.textSecondary }]}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.xl,
    gap: spacing.sm,
  },
  iconRing: {
    width: 56,
    height: 56,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
    borderWidth: 1,
  },
  emoji: {
    fontSize: 22,
  },
  title: {
    ...typography.title,
    fontSize: 18,
    textAlign: 'center',
  },
  body: {
    ...typography.body,
    fontSize: 14,
    textAlign: 'center',
    maxWidth: 320,
  },
});
