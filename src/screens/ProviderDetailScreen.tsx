import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../app/AppContext';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { buildTimeSeries } from '../services/analytics';
import { resolveCostUsd } from '../services/pricing';
import { PROVIDER_CATALOG } from '../services/providers/catalog';
import { colors, radius, spacing } from '../theme/colors';
import { formatRelativeTime, formatTokens, formatUsd } from '../utils/format';

interface Props {
  providerId: string;
  onBack: () => void;
}

export function ProviderDetailScreen({ providerId, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const {
    providers,
    history,
    refreshProvider,
    removeProvider,
    logManualUsage,
    updateCredential,
    refreshingId,
  } = useApp();

  const provider = providers.find((p) => p.id === providerId);
  const [cost, setCost] = useState('');
  const [inputTok, setInputTok] = useState('');
  const [outputTok, setOutputTok] = useState('');
  const [note, setNote] = useState('');
  const [newKey, setNewKey] = useState('');
  const [busy, setBusy] = useState(false);

  const providerHistory = useMemo(
    () => history.filter((h) => h.providerId === providerId),
    [history, providerId],
  );

  const series = useMemo(
    () =>
      buildTimeSeries(
        providerHistory,
        provider ? [provider] : [],
        14,
      ),
    [providerHistory, provider],
  );

  const liveEstimate = useMemo(() => {
    if (!provider?.lastUsage) return null;
    return resolveCostUsd({
      kind: provider.kind,
      costUsd: provider.lastUsage.costUsd,
      inputTokens: provider.lastUsage.inputTokens,
      outputTokens: provider.lastUsage.outputTokens,
      totalTokens: provider.lastUsage.totalTokens,
    });
  }, [provider]);

  if (!provider) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + spacing.lg }]}>
        <Pressable onPress={onBack}>
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.missing}>Provider not found</Text>
      </View>
    );
  }

  const def = PROVIDER_CATALOG[provider.kind];
  const usage = provider.lastUsage;

  const onManual = async () => {
    setBusy(true);
    try {
      await logManualUsage(provider.id, {
        costUsd: cost.trim() === '' ? null : Number(cost),
        inputTokens: inputTok.trim() === '' ? null : Number(inputTok),
        outputTokens: outputTok.trim() === '' ? null : Number(outputTok),
        note: note.trim() || undefined,
      });
      setCost('');
      setInputTok('');
      setOutputTok('');
      setNote('');
      Alert.alert('Saved', 'Manual usage snapshot stored only on this device.');
    } finally {
      setBusy(false);
    }
  };

  const onUpdateKey = async () => {
    if (!newKey.trim()) return;
    await updateCredential(provider.id, newKey.trim());
    setNewKey('');
    await refreshProvider(provider.id);
    Alert.alert('Key updated', 'Encrypted on device. Previous key overwritten.');
  };

  const onDelete = () => {
    Alert.alert(
      'Remove provider?',
      'Deletes the encrypted key and local usage for this provider from this device only.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            await removeProvider(provider.id);
            onBack();
          },
        },
      ],
    );
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: 40,
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
      }}
      keyboardShouldPersistTaps="handled"
    >
      <Pressable onPress={onBack}>
        <Text style={styles.back}>← Back</Text>
      </Pressable>

      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: def.color + '22' }]}>
          <Text style={[styles.badgeText, { color: def.color }]}>
            {def.shortName}
          </Text>
        </View>
        <Text style={styles.title}>{provider.label}</Text>
        <Text style={styles.sub}>{def.description}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Latest snapshot</Text>
        <View style={styles.grid}>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Cost</Text>
            <Text style={styles.cellValue}>{formatUsd(usage?.costUsd)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Tokens</Text>
            <Text style={styles.cellValue}>{formatTokens(usage?.totalTokens)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Input</Text>
            <Text style={styles.cellValue}>{formatTokens(usage?.inputTokens)}</Text>
          </View>
          <View style={styles.cell}>
            <Text style={styles.cellLabel}>Output</Text>
            <Text style={styles.cellValue}>{formatTokens(usage?.outputTokens)}</Text>
          </View>
        </View>
        {liveEstimate?.isEstimate && liveEstimate.value != null ? (
          <Text style={styles.estimate}>
            Est. cost {formatUsd(liveEstimate.value)}
            {liveEstimate.modelLabel ? ` · ${liveEstimate.modelLabel} rates` : ''}
          </Text>
        ) : null}
        <Text style={styles.meta}>
          Source: {usage?.source ?? '—'} · {formatRelativeTime(usage?.fetchedAt)}
        </Text>
        {usage?.windowLabel ? (
          <Text style={styles.meta}>{usage.windowLabel}</Text>
        ) : null}
        {provider.lastError ? (
          <Text style={styles.error}>{provider.lastError}</Text>
        ) : null}

        <Pressable
          style={styles.secondaryBtn}
          onPress={() => refreshProvider(provider.id)}
        >
          {refreshingId === provider.id ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.secondaryBtnText}>Refresh from provider</Text>
          )}
        </Pressable>
      </View>

      <TimeSeriesChart
        points={series.points}
        title="14-day usage"
        subtitle={
          series.projectedMonthlyCost != null
            ? `~${formatUsd(series.projectedMonthlyCost)} / 30 days at current pace`
            : `${providerHistory.length} local snapshot${providerHistory.length === 1 ? '' : 's'}`
        }
        color={def.color}
        emptyHint="Refresh or log snapshots for this provider to chart usage over time."
      />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Manual snapshot</Text>
        <Text style={styles.help}>
          Use this when auto-usage isn’t available. Leave cost blank and enter tokens
          to store a snapshot — the dashboard will estimate cost from list rates.
        </Text>
        <TextInput
          style={styles.input}
          placeholder="Cost USD (e.g. 12.40)"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
          value={cost}
          onChangeText={setCost}
        />
        <TextInput
          style={styles.input}
          placeholder="Input tokens"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          value={inputTok}
          onChangeText={setInputTok}
        />
        <TextInput
          style={styles.input}
          placeholder="Output tokens"
          placeholderTextColor={colors.textMuted}
          keyboardType="number-pad"
          value={outputTok}
          onChangeText={setOutputTok}
        />
        <TextInput
          style={styles.input}
          placeholder="Note (optional)"
          placeholderTextColor={colors.textMuted}
          value={note}
          onChangeText={setNote}
        />
        <Pressable style={styles.primaryBtn} onPress={onManual} disabled={busy}>
          <Text style={styles.primaryBtnText}>Save snapshot</Text>
        </Pressable>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Update API key</Text>
        <TextInput
          style={styles.input}
          placeholder={def.keyHint}
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          autoCapitalize="none"
          value={newKey}
          onChangeText={setNewKey}
        />
        <Pressable style={styles.secondaryBtn} onPress={onUpdateKey}>
          <Text style={styles.secondaryBtnText}>Replace encrypted key</Text>
        </Pressable>
      </View>

      <Pressable style={styles.dangerBtn} onPress={onDelete}>
        <Text style={styles.dangerBtnText}>Remove provider from this device</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  back: { color: colors.accent, fontWeight: '600', fontSize: 16 },
  missing: { color: colors.text, marginTop: spacing.xl, fontSize: 16 },
  header: { gap: spacing.sm },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.full,
  },
  badgeText: { fontWeight: '800', fontSize: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: '800' },
  sub: { color: colors.textSecondary, fontSize: 14 },
  card: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  help: { color: colors.textSecondary, fontSize: 13, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { width: '45%' },
  cellLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  cellValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  meta: { color: colors.textMuted, fontSize: 12 },
  estimate: {
    color: colors.warning,
    fontSize: 13,
    fontWeight: '600',
  },
  error: { color: colors.danger, fontSize: 13 },
  input: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    marginTop: 4,
  },
  primaryBtn: {
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },
  secondaryBtn: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    backgroundColor: colors.bgElevated,
  },
  secondaryBtnText: { color: colors.accent, fontWeight: '700' },
  dangerBtn: {
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    backgroundColor: colors.dangerSoft,
  },
  dangerBtnText: { color: colors.danger, fontWeight: '700' },
});
