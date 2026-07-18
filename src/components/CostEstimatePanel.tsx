import { StyleSheet, Text, View } from 'react-native';
import type { CostEstimateRow } from '../services/analytics';
import { colors, radius, spacing } from '../theme/colors';
import { formatTokens, formatUsd } from '../utils/format';

interface Props {
  rows: CostEstimateRow[];
  total: number;
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
  const active = rows.filter((r) => r.displayCost != null && r.displayCost > 0);
  const max = Math.max(...active.map((r) => r.displayCost ?? 0), 1);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>Cost estimates</Text>
      <Text style={styles.subtitle}>
        Reported API costs when available; otherwise token × public list rates
        (clearly marked).
      </Text>

      <View style={styles.summaryRow}>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>Best total</Text>
          <Text style={styles.summaryValue}>{formatUsd(total || null)}</Text>
          <Text style={styles.summaryHint}>
            {reportedPortion > 0 && estimatedPortion > 0
              ? `${formatUsd(reportedPortion)} reported · ${formatUsd(estimatedPortion)} est.`
              : estimatedPortion > 0
                ? 'includes estimates'
                : reportedPortion > 0
                  ? 'from providers'
                  : 'no cost data yet'}
          </Text>
        </View>
        <View style={styles.summaryCell}>
          <Text style={styles.summaryLabel}>~30-day pace</Text>
          <Text style={styles.summaryValue}>
            {formatUsd(projectedMonthly)}
          </Text>
          <Text style={styles.summaryHint}>
            {averageDaily != null && averageDaily > 0
              ? `${formatUsd(averageDaily)}/day avg`
              : 'needs history deltas'}
          </Text>
        </View>
      </View>

      {active.length === 0 ? (
        <Text style={styles.empty}>
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
                  <Text style={styles.rowLabel} numberOfLines={1}>
                    {r.label}
                  </Text>
                  <Text style={styles.rowCost}>
                    {formatUsd(r.displayCost)}
                    {r.isEstimate ? ' *' : ''}
                  </Text>
                </View>
                <View style={styles.track}>
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
                <Text style={styles.rowMeta}>
                  {r.isEstimate
                    ? `Estimate · ${r.estimateModel ?? 'default rates'}${
                        r.tokens != null ? ` · ${formatTokens(r.tokens)} tok` : ''
                      }`
                    : `Reported${r.tokens != null ? ` · ${formatTokens(r.tokens)} tok` : ''}`}
                </Text>
              </View>
            ))}
        </View>
      )}

      {estimatedPortion > 0 ? (
        <Text style={styles.footnote}>
          * Estimated from tokens using public list prices — not a bill.
        </Text>
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
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 17,
    marginTop: -4,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  summaryCell: {
    flex: 1,
    backgroundColor: colors.bgElevated,
    borderRadius: radius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderSubtle,
  },
  summaryLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  summaryValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 4,
  },
  summaryHint: {
    color: colors.textSecondary,
    fontSize: 11,
    marginTop: 4,
  },
  empty: {
    color: colors.textSecondary,
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
    color: colors.text,
    fontSize: 13,
    fontWeight: '600',
  },
  rowCost: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.bgElevated,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 3,
  },
  rowMeta: {
    color: colors.textMuted,
    fontSize: 11,
  },
  footnote: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: 'italic',
  },
});
