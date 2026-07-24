import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { ProviderConfig } from '../types';
import { PROVIDER_CATALOG } from '../services/providers/catalog';
import {
  capabilityStatusLabel,
  resolveUsageCapability,
  supportsAutoRefresh,
} from '../services/usageCapability';
import { hasUsageMetrics } from '../services/usageSnapshots';
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
  const capability = resolveUsageCapability(provider);
  const hasMetrics = hasUsageMetrics(usage);
  const showAutoRefresh = supportsAutoRefresh(capability) || capability === 'validate-only';

  return (
    <Pressable
      onPress={onPress}
      android_ripple={
        isMaterialChrome
          ? { color: 'rgba(139,147,255,0.08)' }
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
            {showAutoRefresh ? (
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
                accessibilityLabel={
                  supportsAutoRefresh(capability)
                    ? `Refresh ${provider.label}`
                    : `Re-validate ${provider.label}`
                }
              >
                {refreshing ? (
                  <ActivityIndicator size="small" color={t.accent} />
                ) : (
                  <Text style={[styles.refreshText, { color: t.accent }]}>↻</Text>
                )}
              </Pressable>
            ) : null}
          </View>

          <View
            style={[
              styles.chip,
              {
                backgroundColor:
                  capability === 'full'
                    ? t.privacySoft
                    : capability === 'none'
                      ? t.dangerSoft
                      : t.accentSoft,
                borderColor:
                  capability === 'full'
                    ? 'rgba(61, 220, 151, 0.25)'
                    : capability === 'none'
                      ? t.border
                      : t.borderSubtle,
              },
            ]}
          >
            <Text
              style={{
                color:
                  capability === 'full'
                    ? t.privacy
                    : capability === 'none'
                      ? t.danger
                      : t.textSecondary,
                fontSize: 11,
                fontWeight: '600',
              }}
            >
              {capabilityStatusLabel(capability)}
            </Text>
          </View>

          {hasMetrics ? (
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
          ) : (
            <Text style={[styles.hint, { color: t.textMuted }]}>
              {capability === 'validate-only'
                ? 'Key works. Log a manual snapshot or use an admin key for automatic usage.'
                : capability === 'manual-only'
                  ? 'Log a manual snapshot to track spend and tokens.'
                  : capability === 'none'
                    ? 'Add an API key to validate or log usage manually.'
                    : usage?.windowLabel ?? 'No usage yet'}
            </Text>
          )}

          {provider.lastError ? (
            <Text style={[styles.error, { color: t.danger }]} numberOfLines={2}>
              {provider.lastError}
            </Text>
          ) : hasMetrics && usage?.windowLabel ? (
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
  chip: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
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
  hint: {
    fontSize: 13,
    lineHeight: 18,
  },
  error: {
    fontSize: 12,
    lineHeight: 16,
  },
  window: {
    fontSize: 12,
  },
});
