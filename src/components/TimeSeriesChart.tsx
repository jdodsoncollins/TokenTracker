import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { DayPoint } from '../services/analytics';
import { getTheme, isMaterialChrome, spacing, typography } from '../theme/tokens';
import { formatTokens, formatUsd } from '../utils/format';
import { Surface } from './ui/Surface';

export type ChartMetric = 'costDelta' | 'costLevel' | 'tokenDelta' | 'tokenLevel';

interface Props {
  points: DayPoint[];
  title: string;
  subtitle?: string;
  metric?: ChartMetric;
  color?: string;
  emptyHint?: string;
  showMetricToggle?: boolean;
}

const METRICS: { id: ChartMetric; label: string }[] = [
  { id: 'costDelta', label: 'Spend Δ' },
  { id: 'costLevel', label: 'Cost' },
  { id: 'tokenDelta', label: 'Tokens Δ' },
  { id: 'tokenLevel', label: 'Tokens' },
];

function valueOf(p: DayPoint, metric: ChartMetric): number {
  switch (metric) {
    case 'costDelta':
      return p.costDelta;
    case 'costLevel':
      return p.costLevel;
    case 'tokenDelta':
      return p.tokenDelta;
    case 'tokenLevel':
      return p.tokenLevel;
  }
}

function formatValue(metric: ChartMetric, v: number): string {
  if (metric.startsWith('token')) return formatTokens(v);
  return formatUsd(v);
}

export function TimeSeriesChart({
  points,
  title,
  subtitle,
  metric: metricProp,
  color,
  emptyHint = 'Refresh providers or log manual snapshots to build a timeline.',
  showMetricToggle = true,
}: Props) {
  const t = getTheme();
  const chartColor = color ?? t.accent;
  const [metric, setMetric] = useState<ChartMetric>(metricProp ?? 'costDelta');
  const active = metricProp ?? metric;
  const [selected, setSelected] = useState<number | null>(null);

  const max = useMemo(() => {
    const m = Math.max(...points.map((p) => valueOf(p, active)), 0);
    return m > 0 ? m : 1;
  }, [points, active]);

  const hasData = points.some((p) => valueOf(p, active) > 0);
  const chartHeight = 140;
  const selectedPoint =
    selected != null && selected >= 0 && selected < points.length
      ? points[selected]
      : null;
  const labelEvery = points.length > 14 ? 4 : points.length > 8 ? 2 : 1;
  const peak = hasData
    ? Math.max(...points.map((p) => valueOf(p, active)))
    : 0;

  return (
    <Surface variant="card" padded>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: t.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: t.textMuted }]}>{subtitle}</Text>
          ) : null}
        </View>
        {selectedPoint ? (
          <View
            style={[
              styles.tooltip,
              {
                backgroundColor: t.bgElevated,
                borderColor: t.border,
                borderRadius: t.radius.sm,
              },
            ]}
          >
            <Text style={[styles.tooltipLabel, { color: t.textMuted }]}>
              {selectedPoint.label}
            </Text>
            <Text style={[styles.tooltipValue, { color: t.text }]}>
              {formatValue(active, valueOf(selectedPoint, active))}
            </Text>
          </View>
        ) : null}
      </View>

      {showMetricToggle && !metricProp ? (
        <View style={styles.tabs}>
          {METRICS.map((m) => {
            const on = m.id === active;
            return (
              <Pressable
                key={m.id}
                onPress={() => {
                  setMetric(m.id);
                  setSelected(null);
                }}
                style={[
                  styles.tab,
                  {
                    borderRadius: isMaterialChrome ? t.radius.full : t.radius.full,
                    backgroundColor: on ? t.accentSoft : t.bgElevated,
                    borderColor: on ? t.accent : t.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabText,
                    { color: on ? t.accent : t.textMuted },
                  ]}
                >
                  {m.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!hasData ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: t.textSecondary }]}>
            {emptyHint}
          </Text>
        </View>
      ) : (
        <View style={[styles.chart, { height: chartHeight + 28 }]}>
          <View
            style={[
              styles.gridLine,
              { bottom: 28 + chartHeight * 0.25, backgroundColor: t.borderSubtle },
            ]}
          />
          <View
            style={[
              styles.gridLine,
              { bottom: 28 + chartHeight * 0.5, backgroundColor: t.borderSubtle },
            ]}
          />
          <View
            style={[
              styles.gridLine,
              { bottom: 28 + chartHeight * 0.75, backgroundColor: t.borderSubtle },
            ]}
          />

          <View style={[styles.barsRow, { height: chartHeight }]}>
            {points.map((p, i) => {
              const v = valueOf(p, active);
              const h = Math.max(v > 0 ? 4 : 0, (v / max) * chartHeight);
              const isSel = selected === i;
              return (
                <Pressable
                  key={p.date}
                  style={styles.barHit}
                  onPress={() => setSelected(isSel ? null : i)}
                  accessibilityLabel={`${p.label}: ${formatValue(active, v)}`}
                >
                  <View style={styles.barCol}>
                    <View
                      style={[
                        styles.bar,
                        {
                          height: h,
                          backgroundColor: isSel ? t.text : chartColor,
                          opacity: v > 0 ? 1 : 0.15,
                          borderTopLeftRadius: isMaterialChrome ? 4 : 3,
                          borderTopRightRadius: isMaterialChrome ? 4 : 3,
                        },
                      ]}
                    />
                  </View>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.labels}>
            {points.map((p, i) => (
              <View key={p.date} style={styles.labelCell}>
                {i % labelEvery === 0 || i === points.length - 1 ? (
                  <Text style={[styles.axisLabel, { color: t.textMuted }]} numberOfLines={1}>
                    {p.label}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>
        </View>
      )}

      {hasData ? (
        <View style={styles.footer}>
          <Text style={[styles.footerText, { color: t.textSecondary }]}>
            Peak {formatValue(active, peak)}
          </Text>
          <Text style={[styles.footerHint, { color: t.textMuted }]}>
            Tap a bar for detail
          </Text>
        </View>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  tooltip: {
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignItems: 'flex-end',
  },
  tooltipLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  tooltipValue: {
    fontSize: 14,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: spacing.md,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
  },
  tabText: {
    fontSize: 11,
    fontWeight: '600',
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 280,
  },
  chart: {
    position: 'relative',
    justifyContent: 'flex-end',
  },
  gridLine: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: StyleSheet.hairlineWidth,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  barHit: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
  },
  barCol: {
    flex: 1,
    justifyContent: 'flex-end',
    minHeight: 4,
  },
  bar: {
    minHeight: 0,
  },
  labels: {
    flexDirection: 'row',
    marginTop: 6,
    height: 22,
  },
  labelCell: {
    flex: 1,
    alignItems: 'center',
  },
  axisLabel: {
    fontSize: 9,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  footerText: {
    fontSize: 12,
    fontWeight: '600',
  },
  footerHint: {
    fontSize: 11,
  },
});
