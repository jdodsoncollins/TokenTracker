import { StyleSheet, Text, View } from 'react-native';
import type { CostEstimateRow } from '../services/analytics';
import { getTheme, spacing, typography } from '../theme/tokens';
import { formatTokens, formatUsd } from '../utils/format';
import { Surface } from './ui/Surface';

interface Props {
  rows: CostEstimateRow[];
  total: number | null;
  estimatedPortion: number;
  reportedPortion: number;
  projectedMonthly: number | null;
  averageDaily: number | null;
}

export function CostEstimatePanel({
  rows,
  total,
  estimatedPortion,
  reportedPortion,
  projectedMonthly,
  averageDaily,
}: Props) {
  const t = getTheme();
  const active = rows.filter((r) => r.displayCost != null && r.displayCost > 0);
  const max = Math.max(...active.map((r) => r.displayCost ?? 0), 1);

  return (
    <Surface variant="card" padded>
      <Text style={[styles.title, { color: t.text }]}>Cost estimates</Text>
      <Text style={[styles.subtitle, { color: t.textMuted }]}>
        Latest readings stay separate unless their measurement windows match. Token
        estimates require an explicit model.
      </Text>

      <View style={styles.summaryRow}>
        <View
          style={[
            styles.summaryCell,
            {
              backgroundColor: t.bgElevated,
              borderColor: t.borderSubtle,
              borderRadius: t.radius.md,
            },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: t.textMuted }]}>
            Comparable total
          </Text>
          <Text style={[styles.summaryValue, { color: t.text }]}>
            {formatUsd(total)}
          </Text>
          <Text style={[styles.summaryHint, { color: t.textSecondary }]}>
            {reportedPortion > 0 && estimatedPortion > 0
              ? `${formatUsd(reportedPortion)} reported · ${formatUsd(estimatedPortion)} est.`
              : estimatedPortion > 0
                ? 'includes estimates'
                  : reportedPortion > 0
                    ? 'from providers'
                    : active.length > 0
                      ? 'windows do not match'
                      : 'no cost data yet'}
          </Text>
        </View>
        <View
          style={[
            styles.summaryCell,
            {
              backgroundColor: t.bgElevated,
              borderColor: t.borderSubtle,
              borderRadius: t.radius.md,
            },
          ]}
        >
          <Text style={[styles.summaryLabel, { color: t.textMuted }]}>~30-day pace</Text>
          <Text style={[styles.summaryValue, { color: t.text }]}>
            {formatUsd(projectedMonthly)}
          </Text>
          <Text style={[styles.summaryHint, { color: t.textSecondary }]}>
            {averageDaily != null && averageDaily > 0
              ? `${formatUsd(averageDaily)}/day avg`
              : 'needs history deltas'}
          </Text>
        </View>
      </View>

      {active.length === 0 ? (
        <Text style={[styles.empty, { color: t.textSecondary }]}>
          Add usage with costs or tokens to see per-provider estimates.
        </Text>
      ) : (
        <View style={styles.list}>
          {active
            .slice()
            .sort((a, b) => (b.displayCost ?? 0) - (a.displayCost ?? 0))
            .map((r) => (
              <View key={r.providerId} style={styles.row}>
                <View style={styles.rowTop}>
                  <View style={[styles.dot, { backgroundColor: r.color }]} />
                  <Text style={[styles.rowLabel, { color: t.text }]} numberOfLines={1}>
                    {r.label}
                  </Text>
                  <Text style={[styles.rowCost, { color: t.text }]}>
                    {formatUsd(r.displayCost)}
                    {r.isEstimate ? ' *' : ''}
                  </Text>
                </View>
                <View style={[styles.track, { backgroundColor: t.bgElevated }]}>
                  <View
                    style={[
                      styles.fill,
                      {
                        width: `${Math.max(4, ((r.displayCost ?? 0) / max) * 100)}%`,
                        backgroundColor: r.color,
                        opacity: r.isEstimate ? 0.55 : 1,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.rowMeta, { color: t.textMuted }]}>
                  {r.isEstimate
                    ? `Estimate · ${r.estimateModel ?? 'selected rates'}${
                        r.tokens != null ? ` · ${formatTokens(r.tokens)} tok` : ''
                      }`
                    : `Reported${r.tokens != null ? ` · ${formatTokens(r.tokens)} tok` : ''}`}
                  {` · ${r.measurementKind}`}
                </Text>
              </View>
            ))}
        </View>
      )}

      {active.some((row) => row.isEstimate) ? (
        <Text style={[styles.footnote, { color: t.textMuted }]}>
          * Estimated from tokens using public list prices — not a bill.
        </Text>
      ) : null}
    </Surface>
  );
}

const styles = StyleSheet.create({
  title: {
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: spacing.md,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  summaryCell: {
    flex: 1,
    padding: spacing.md,
    borderWidth: 1,
  },
  summaryLabel: {
    ...typography.overline,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  summaryHint: {
    fontSize: 11,
    marginTop: 4,
  },
  empty: {
    fontSize: 13,
    lineHeight: 18,
  },
  list: {
    gap: spacing.md,
  },
  row: {
    gap: 4,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '600',
  },
  rowCost: {
    fontSize: 13,
    fontWeight: '700',
  },
  track: {
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  rowMeta: {
    fontSize: 11,
  },
  footnote: {
    fontSize: 11,
    fontStyle: 'italic',
    marginTop: spacing.sm,
  },
});
