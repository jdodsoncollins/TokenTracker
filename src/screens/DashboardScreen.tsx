import { useMemo } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../app/AppContext';
import { EmptyState } from '../components/EmptyState';
import { PrivacyBanner } from '../components/PrivacyBanner';
import { ProviderCard } from '../components/ProviderCard';
import { StatCard } from '../components/StatCard';
import { PROVIDER_CATALOG } from '../services/providers/catalog';
import { colors, radius, spacing } from '../theme/colors';
import { formatTokens, formatUsd } from '../utils/format';

interface Props {
  onOpenPrivacy: () => void;
  onOpenProviders: () => void;
  onOpenProvider: (id: string) => void;
}

export function DashboardScreen({
  onOpenPrivacy,
  onOpenProviders,
  onOpenProvider,
}: Props) {
  const insets = useSafeAreaInsets();
  const { ready, providers, totals, refreshingId, refreshAll, refreshProvider } =
    useApp();

  const breakdown = useMemo(() => {
    return providers
      .map((p) => ({
        id: p.id,
        label: p.label,
        color: PROVIDER_CATALOG[p.kind].color,
        cost: p.lastUsage?.costUsd ?? 0,
      }))
      .filter((b) => b.cost > 0)
      .sort((a, b) => b.cost - a.cost);
  }, [providers]);

  const maxCost = breakdown[0]?.cost || 1;

  if (!ready) {
    return (
      <View style={[styles.center, { paddingTop: insets.top }]}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        { paddingTop: insets.top + spacing.lg, paddingBottom: 120 },
      ]}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.kicker}>LOCAL · ENCRYPTED</Text>
          <Text style={styles.title}>TokenTracker</Text>
        </View>
        <Pressable
          onPress={() => refreshAll()}
          style={styles.refreshAll}
          accessibilityLabel="Refresh all providers"
        >
          <Text style={styles.refreshAllText}>Refresh</Text>
        </Pressable>
      </View>

      <PrivacyBanner compact onPress={onOpenPrivacy} />

      <View style={styles.statsRow}>
        <StatCard
          label="Tracked spend"
          value={formatUsd(totals.withCost ? totals.costUsd : null)}
          hint={
            totals.withCost
              ? `${totals.withCost} provider${totals.withCost === 1 ? '' : 's'}`
              : 'Add keys or manual entries'
          }
          accent={colors.accent}
        />
        <StatCard
          label="Tokens"
          value={formatTokens(totals.withTokens ? totals.tokens : null)}
          hint={
            totals.withTokens
              ? 'sum of known totals'
              : 'when providers report them'
          }
          accent={colors.info}
        />
      </View>

      {breakdown.length > 0 && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Spend mix</Text>
          <View style={styles.bars}>
            {breakdown.map((b) => (
              <View key={b.id} style={styles.barRow}>
                <Text style={styles.barLabel} numberOfLines={1}>
                  {b.label}
                </Text>
                <View style={styles.barTrack}>
                  <View
                    style={[
                      styles.barFill,
                      {
                        backgroundColor: b.color,
                        width: `${Math.max(6, (b.cost / maxCost) * 100)}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.barValue}>{formatUsd(b.cost)}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Providers</Text>
          <Pressable onPress={onOpenProviders}>
            <Text style={styles.link}>Manage</Text>
          </Pressable>
        </View>

        {providers.length === 0 ? (
          <View style={styles.emptyCard}>
            <EmptyState
              title="No providers yet"
              body="Add OpenAI, Anthropic, xAI/Grok, OpenRouter, Gemini, or a custom endpoint. Keys are encrypted on-device."
            />
            <Pressable style={styles.cta} onPress={onOpenProviders}>
              <Text style={styles.ctaText}>Add a provider</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.list}>
            {providers.map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                refreshing={refreshingId === p.id}
                onPress={() => onOpenProvider(p.id)}
                onRefresh={() => refreshProvider(p.id)}
              />
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  center: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  kicker: {
    color: colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    color: colors.text,
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: -0.8,
    marginTop: 4,
  },
  refreshAll: {
    backgroundColor: colors.bgCard,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
  },
  refreshAllText: {
    color: colors.text,
    fontWeight: '600',
    fontSize: 14,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  section: {
    gap: spacing.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  link: {
    color: colors.accent,
    fontWeight: '600',
    fontSize: 14,
  },
  bars: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.md,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barLabel: {
    color: colors.textSecondary,
    width: 72,
    fontSize: 12,
    fontWeight: '600',
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barValue: {
    color: colors.text,
    width: 64,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    gap: spacing.md,
  },
  emptyCard: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingBottom: spacing.xl,
  },
  cta: {
    alignSelf: 'center',
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.full,
  },
  ctaText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
});
