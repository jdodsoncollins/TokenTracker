import { useMemo, useState } from 'react';
import { LayoutChangeEvent, Pressable, StyleSheet, Text, View } from 'react-native';
import type { DayPoint } from '../services/analytics';
import { colors, radius, spacing } from '../theme/colors';
import { formatTokens, formatUsd } from '../utils/format';

export type ChartMetric = 'costDelta' | 'costLevel' | 'tokenDelta' | 'tokenLevel';

interface Props {
  points: DayPoint[];
  title: string;
  subtitle?: string;
  metric?: ChartMetric;
  color?: string;
  emptyHint?: string;
  /** Allow switching metric tabs */
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
  color = colors.accent,
  emptyHint = 'Refresh providers or log manual snapshots to build a timeline.',
  showMetricToggle = true,
}: Props) {
  const [metric, setMetric] = useState<ChartMetric>(metricProp ?? 'costDelta');
  const active = metricProp ?? metric;
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const max = useMemo(() => {
    const m = Math.max(...points.map((p) => valueOf(p, active)), 0);
    return m > 0 ? m : 1;
  }, [points, active]);

  const hasData = points.some((p) => valueOf(p, active) > 0);
  const chartHeight = 140;

  const onLayout = (e: LayoutChangeEvent) => {
    setWidth(e.nativeEvent.layout.width);
  };

  const selectedPoint =
    selected != null && selected >= 0 && selected < points.length
      ? points[selected]
      : null;

  // Label stride so we don't crowd the axis
  const labelEvery = points.length > 14 ? 4 : points.length > 8 ? 2 : 1;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
        {selectedPoint ? (
          <View style={styles.tooltip}>
            <Text style={styles.tooltipLabel}>{selectedPoint.label}</Text>
            <Text style={styles.tooltipValue}>
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
                style={[styles.tab, on && styles.tabOn]}
              >
                <Text style={[styles.tabText, on && styles.tabTextOn]}>{m.label}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {!hasData ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>{emptyHint}</Text>
        </View>
      ) : (
        <View onLayout={onLayout} style={[styles.chart, { height: chartHeight + 28 }]}>
          {/* grid lines */}
          <View style={[styles.gridLine, { bottom: 28 + chartHeight * 0.25 }]} />
          <View style={[styles.gridLine, { bottom: 28 + chartHeight * 0.5 }]} />
          <View style={[styles.gridLine, { bottom: 28 + chartHeight * 0.75 }]} />

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
                          backgroundColor: isSel ? colors.text : color,
                          opacity: v > 0 ? 1 : 0.15,
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
                  <Text style={styles.axisLabel} numberOfLines={1}>
                    {p.label.replace(/ /g, '\n')}
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          {width > 0 ? null : null}
        </View>
      )}

      {hasData ? (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Peak {formatValue(active, max === 1 && !hasData ? 0 : Math.max(...points.map((p) => valueOf(p, active))))}
          </Text>
          <Text style={styles.footerHint}>Tap a bar for detail</Text>
        </View>
      ) : null}
    </View>
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
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  tooltip: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    alignItems: 'flex-end',
  },
  tooltipLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  tooltipValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tab: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.full,
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
  },
  tabOn: {
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
  },
  tabText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  tabTextOn: {
    color: colors.accent,
  },
  empty: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    color: colors.textSecondary,
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
    backgroundColor: colors.borderSubtle,
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
    borderTopLeftRadius: 3,
    borderTopRightRadius: 3,
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
    color: colors.textMuted,
    fontSize: 9,
    textAlign: 'center',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  footerText: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '600',
  },
  footerHint: {
    color: colors.textMuted,
    fontSize: 11,
  },
});
