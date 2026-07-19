import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ProviderConfig } from '../types';
import { PROVIDER_CATALOG } from '../services/providers/catalog';
import { getTheme, isMaterialChrome, spacing, typography } from '../theme/tokens';
import { formatRelativeTime, formatTokens, formatUsd } from '../utils/format';
import { Surface } from './ui/Surface';

interface Props {
  provider: ProviderConfig;
  refreshing?: boolean;
  onPress?: () => void;
  onRefresh?: () => void;
}

export function ProviderCard({
  provider,
  refreshing,
  onPress,
  onRefresh,
}: Props) {
  const t = getTheme();
  const def = PROVIDER_CATALOG[provider.kind];
  const usage = provider.lastUsage;

  return (
    <Pressable
      onPress={onPress}
      android_ripple={
        isMaterialChrome
          ? { color: 'rgba(180,167,255,0.08)' }
          : undefined
      }
      style={({ pressed }) => [
        pressed && !isMaterialChrome ? { opacity: 0.92 } : null,
      ]}
    >
      <Surface variant="card" padded={false}>
        <View style={styles.inner}>
          <View style={styles.row}>
            <View style={[styles.badge, { backgroundColor: def.color + '22' }]}>
              <Text style={[styles.badgeText, { color: def.color }]}>
                {def.shortName.slice(0, 2).toUpperCase()}
              </Text>
            </View>
            <View style={styles.meta}>
              <Text style={[styles.title, { color: t.text }]}>{provider.label}</Text>
              <Text style={[styles.sub, { color: t.textMuted }]}>
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
              style={[
                styles.refreshBtn,
                {
                  backgroundColor: t.bgElevated,
                  borderColor: t.border,
                  borderRadius: t.radius.full,
                },
              ]}
              accessibilityLabel={`Refresh ${provider.label}`}
            >
              {refreshing ? (
                <ActivityIndicator size="small" color={t.accent} />
              ) : (
                <Text style={[styles.refreshText, { color: t.accent }]}>↻</Text>
              )}
            </Pressable>
          </View>

          <View style={styles.stats}>
            <View style={styles.stat}>
              <Text style={[styles.statLabel, { color: t.textMuted }]}>Cost</Text>
              <Text style={[styles.statValue, { color: t.text }]}>
                {formatUsd(usage?.costUsd)}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statLabel, { color: t.textMuted }]}>Tokens</Text>
              <Text style={[styles.statValue, { color: t.text }]}>
                {formatTokens(usage?.totalTokens)}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={[styles.statLabel, { color: t.textMuted }]}>
                Updated
              </Text>
              <Text style={[styles.statValueSm, { color: t.textSecondary }]}>
                {formatRelativeTime(usage?.fetchedAt ?? provider.updatedAt)}
              </Text>
            </View>
          </View>

          {provider.lastError ? (
            <Text style={[styles.error, { color: t.danger }]} numberOfLines={2}>
              {provider.lastError}
            </Text>
          ) : usage?.windowLabel ? (
            <Text style={[styles.window, { color: t.textMuted }]}>
              {usage.windowLabel}
            </Text>
          ) : null}
        </View>
      </Surface>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  inner: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 14,
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
    fontSize: 16,
    fontWeight: '700',
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
  },
  refreshBtn: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  refreshText: {
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
    ...typography.overline,
    fontSize: 10,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    marginTop: 2,
  },
  statValueSm: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 4,
  },
  error: {
    fontSize: 12,
    lineHeight: 16,
  },
  window: {
    fontSize: 12,
  },
});
