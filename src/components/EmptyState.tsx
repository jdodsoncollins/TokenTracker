import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme/colors';

interface Props {
  title: string;
  body: string;
}

export function EmptyState({ title, body }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.emoji}>◈</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
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
  emoji: {
    color: colors.accent,
    fontSize: 36,
    marginBottom: spacing.sm,
  },
  title: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
  },
  body: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    maxWidth: 320,
  },
});
