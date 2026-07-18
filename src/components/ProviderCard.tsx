import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { ProviderConfig } from '../types';
import { PROVIDER_CATALOG } from '../services/providers/catalog';
import { colors, radius, spacing } from '../theme/colors';
import { formatRelativeTime, formatTokens, formatUsd } from '../utils/format';

interface Props {
  provider: ProviderConfig;
  refreshing?: boolean;
  onPress?: () => void;
  onRefresh?: () => void;
}

export function ProviderCard({ provider, refreshing, onPress, onRefresh }: Props) {
  const def = PROVIDER_CATALOG[provider.kind];
  const usage = provider.lastUsage;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.row}>
        <View style={[styles.badge, { backgroundColor: def.color + '22' }]}>
          <Text style={[styles.badgeText, { color: def.color }]}>
            {def.shortName.slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <View style={styles.meta}>
          <Text style={styles.title}>{provider.label}</Text>
          <Text style={styles.sub}>
            {def.name}
            {provider.hasCredential ? ' · key on device' : ' · no key'}
          </Text>
        </View>
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onRefresh?.();
          }}
          hitSlop={10}
          style={styles.refreshBtn}
          accessibilityLabel={`Refresh ${provider.label}`}
        >
          {refreshing ? (
            <ActivityIndicator size="small" color={colors.accent} />
          ) : (
            <Text style={styles.refreshText}>↻</Text>
          )}
        </Pressable>
      </View>

      <View style={styles.stats}>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Cost</Text>
          <Text style={styles.statValue}>{formatUsd(usage?.costUsd)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Tokens</Text>
          <Text style={styles.statValue}>{formatTokens(usage?.totalTokens)}</Text>
        </View>
        <View style={styles.stat}>
          <Text style={styles.statLabel}>Updated</Text>
          <Text style={styles.statValueSm}>
            {formatRelativeTime(usage?.fetchedAt ?? provider.updatedAt)}
          </Text>
        </View>
      </View>

      {provider.lastError ? (
        <Text style={styles.error} numberOfLines={2}>
          {provider.lastError}
        </Text>
      ) : usage?.windowLabel ? (
        <Text style={styles.window}>{usage.windowLabel}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  pressed: {
    backgroundColor: colors.bgCardHover,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badge: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontWeight: '800',
    fontSize: 13,
  },
  meta: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  sub: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  refreshBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.bgElevated,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  refreshText: {
    color: colors.accent,
    fontSize: 18,
    fontWeight: '600',
  },
  stats: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  stat: {
    flex: 1,
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  statValueSm: {
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    lineHeight: 16,
  },
  window: {
    color: colors.textMuted,
    fontSize: 12,
  },
});
