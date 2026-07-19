import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useApp } from '../app/AppContext';
import { CostEstimatePanel } from '../components/CostEstimatePanel';
import { EmptyState } from '../components/EmptyState';
import { PrivacyBanner } from '../components/PrivacyBanner';
import { ProviderCard } from '../components/ProviderCard';
import { StatCard } from '../components/StatCard';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { Screen } from '../components/ui/Screen';
import { Surface } from '../components/ui/Surface';
import {
  buildCostEstimateRows,
  buildTimeSeries,
  sumDisplayCost,
  type ChartRange,
} from '../services/analytics';
import { PROVIDER_CATALOG } from '../services/providers/catalog';
import {
  getTheme,
  isMaterialChrome,
  spacing,
  typography,
} from '../theme/tokens';
import { formatTokens, formatUsd } from '../utils/format';

interface Props {
  onOpenPrivacy: () => void;
  onOpenProviders: () => void;
  onOpenProvider: (id: string) => void;
}

const RANGES: ChartRange[] = [7, 14, 30];

export function DashboardScreen({
  onOpenPrivacy,
  onOpenProviders,
  onOpenProvider,
}: Props) {
  const t = getTheme();
  const {
    ready,
    providers,
    history,
    totals,
    refreshingId,
    refreshAll,
    refreshProvider,
  } = useApp();
  const [range, setRange] = useState<ChartRange>(14);

  const series = useMemo(
    () => buildTimeSeries(history, providers, range),
    [history, providers, range],
  );

  const estimateRows = useMemo(
    () => buildCostEstimateRows(providers),
    [providers],
  );

  const estimateSum = useMemo(
    () => sumDisplayCost(estimateRows),
    [estimateRows],
  );

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
      <View style={[styles.center, { backgroundColor: t.bg }]}>
        <ActivityIndicator color={t.accent} size="large" />
      </View>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.kicker, { color: t.accent }]}>
            {isMaterialChrome ? 'MATERIAL · ON-DEVICE' : 'LIQUID GLASS · LOCAL'}
          </Text>
          <Text style={[styles.title, { color: t.text }]}>TokenTracker</Text>
        </View>
        <PrimaryButton
          label="Refresh"
          variant="tonal"
          onPress={() => refreshAll()}
          style={styles.refreshBtn}
        />
      </View>

      <PrivacyBanner compact onPress={onOpenPrivacy} />

      <View style={styles.statsRow}>
        <StatCard
          label="Tracked spend"
          value={formatUsd(
            estimateSum.total > 0
              ? estimateSum.total
              : totals.withCost
                ? totals.costUsd
                : null,
          )}
          hint={
            estimateSum.estimatedPortion > 0
              ? 'includes token estimates'
              : totals.withCost
                ? `${totals.withCost} provider${totals.withCost === 1 ? '' : 's'}`
                : 'Add keys or manual entries'
          }
          accent={t.accent}
        />
        <StatCard
          label="Tokens"
          value={formatTokens(totals.withTokens ? totals.tokens : null)}
          hint={
            totals.withTokens
              ? 'sum of known totals'
              : 'when providers report them'
          }
          accent={t.info}
        />
      </View>

      <View style={styles.rangeRow}>
        <Text style={[styles.sectionTitle, { color: t.text }]}>Usage over time</Text>
        <View style={styles.rangeTabs}>
          {RANGES.map((r) => {
            const on = r === range;
            return (
              <Pressable
                key={r}
                onPress={() => setRange(r)}
                style={[
                  styles.rangeTab,
                  {
                    borderRadius: t.radius.full,
                    backgroundColor: on ? t.accentSoft : t.bgCardSolid,
                    borderColor: on ? t.accent : t.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: on ? t.accent : t.textMuted,
                    fontSize: 12,
                    fontWeight: '700',
                  }}
                >
                  {r}d
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <TimeSeriesChart
        points={series.points}
        title="Timeline"
        subtitle={
          series.hasData
            ? `Spend Δ total ${formatUsd(series.totalCostDelta)} · token Δ ${formatTokens(series.totalTokenDelta)}`
            : 'Local history builds as you refresh or log snapshots'
        }
        color={t.accent}
      />

      <TimeSeriesChart
        points={series.points}
        title="Cost level"
        subtitle="Latest known spend reading (carry-forward per day)"
        metric="costLevel"
        color={t.success}
        showMetricToggle={false}
        emptyHint="No cost levels yet — reported costs or token estimates will appear here."
      />

      <CostEstimatePanel
        rows={estimateRows}
        total={estimateSum.total}
        estimatedPortion={estimateSum.estimatedPortion}
        reportedPortion={estimateSum.reportedPortion}
        projectedMonthly={series.projectedMonthlyCost}
        averageDaily={series.averageDailyCost}
      />

      {breakdown.length > 0 && (
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>
            Spend mix (reported)
          </Text>
          <Surface variant="card" padded>
            <View style={styles.bars}>
              {breakdown.map((b) => (
                <View key={b.id} style={styles.barRow}>
                  <Text
                    style={[styles.barLabel, { color: t.textSecondary }]}
                    numberOfLines={1}
                  >
                    {b.label}
                  </Text>
                  <View style={[styles.barTrack, { backgroundColor: t.bgElevated }]}>
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
                  <Text style={[styles.barValue, { color: t.text }]}>
                    {formatUsd(b.cost)}
                  </Text>
                </View>
              ))}
            </View>
          </Surface>
        </View>
      )}

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>Providers</Text>
          <Pressable onPress={onOpenProviders}>
            <Text style={[styles.link, { color: t.accent }]}>Manage</Text>
          </Pressable>
        </View>

        {providers.length === 0 ? (
          <Surface variant="card" padded={false}>
            <EmptyState
              title="No providers yet"
              body="Add OpenAI, Anthropic, xAI/Grok, OpenRouter, Gemini, or a custom endpoint. Keys are encrypted on-device."
            />
            <View style={styles.ctaWrap}>
              <PrimaryButton label="Add a provider" onPress={onOpenProviders} />
            </View>
          </Surface>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: spacing.md,
  },
  kicker: {
    ...typography.overline,
  },
  title: {
    ...typography.largeTitle,
    marginTop: 4,
  },
  refreshBtn: {
    minHeight: 40,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  rangeTabs: {
    flexDirection: 'row',
    gap: 6,
  },
  rangeTab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
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
    fontSize: 18,
    fontWeight: '700',
  },
  link: {
    fontWeight: '600',
    fontSize: 14,
  },
  bars: {
    gap: spacing.md,
  },
  barRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  barLabel: {
    width: 72,
    fontSize: 12,
    fontWeight: '600',
  },
  barTrack: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 4,
  },
  barValue: {
    width: 64,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '600',
  },
  list: {
    gap: spacing.md,
  },
  ctaWrap: {
    alignItems: 'center',
    paddingBottom: spacing.xl,
  },
});
