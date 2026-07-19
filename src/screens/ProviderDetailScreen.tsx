import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useApp } from '../app/AppContext';
import { TimeSeriesChart } from '../components/TimeSeriesChart';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { Screen } from '../components/ui/Screen';
import { Surface } from '../components/ui/Surface';
import { buildTimeSeries } from '../services/analytics';
import { resolveCostUsd } from '../services/pricing';
import { PROVIDER_CATALOG } from '../services/providers/catalog';
import { getTheme, spacing, typography } from '../theme/tokens';
import { formatRelativeTime, formatTokens, formatUsd } from '../utils/format';

interface Props {
  providerId: string;
  onBack: () => void;
}

export function ProviderDetailScreen({ providerId, onBack }: Props) {
  const t = getTheme();
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
    () => buildTimeSeries(providerHistory, provider ? [provider] : [], 14),
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
      <Screen bottomPad={40}>
        <Pressable onPress={onBack}>
          <Text style={[styles.back, { color: t.accent }]}>← Back</Text>
        </Pressable>
        <Text style={{ color: t.text, marginTop: spacing.xl }}>
          Provider not found
        </Text>
      </Screen>
    );
  }

  const def = PROVIDER_CATALOG[provider.kind];
  const usage = provider.lastUsage;

  const inputStyle = {
    backgroundColor: t.bgElevated,
    borderColor: t.border,
    color: t.text,
    borderRadius: t.radius.md,
  };

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
    <Screen bottomPad={40} keyboard>
      <Pressable onPress={onBack} hitSlop={12}>
        <Text style={[styles.back, { color: t.accent }]}>← Back</Text>
      </Pressable>

      <View style={styles.header}>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: def.color + '22',
              borderRadius: t.radius.full,
            },
          ]}
        >
          <Text style={[styles.badgeText, { color: def.color }]}>
            {def.shortName}
          </Text>
        </View>
        <Text style={[styles.title, { color: t.text }]}>{provider.label}</Text>
        <Text style={[styles.sub, { color: t.textSecondary }]}>
          {def.description}
        </Text>
      </View>

      <Surface variant="card" padded>
        <Text style={[styles.cardTitle, { color: t.text }]}>Latest snapshot</Text>
        <View style={styles.grid}>
          <View style={styles.cell}>
            <Text style={[styles.cellLabel, { color: t.textMuted }]}>Cost</Text>
            <Text style={[styles.cellValue, { color: t.text }]}>
              {formatUsd(usage?.costUsd)}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={[styles.cellLabel, { color: t.textMuted }]}>Tokens</Text>
            <Text style={[styles.cellValue, { color: t.text }]}>
              {formatTokens(usage?.totalTokens)}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={[styles.cellLabel, { color: t.textMuted }]}>Input</Text>
            <Text style={[styles.cellValue, { color: t.text }]}>
              {formatTokens(usage?.inputTokens)}
            </Text>
          </View>
          <View style={styles.cell}>
            <Text style={[styles.cellLabel, { color: t.textMuted }]}>Output</Text>
            <Text style={[styles.cellValue, { color: t.text }]}>
              {formatTokens(usage?.outputTokens)}
            </Text>
          </View>
        </View>
        {liveEstimate?.isEstimate && liveEstimate.value != null ? (
          <Text style={[styles.estimate, { color: t.warning }]}>
            Est. cost {formatUsd(liveEstimate.value)}
            {liveEstimate.modelLabel ? ` · ${liveEstimate.modelLabel} rates` : ''}
          </Text>
        ) : null}
        <Text style={[styles.meta, { color: t.textMuted }]}>
          Source: {usage?.source ?? '—'} · {formatRelativeTime(usage?.fetchedAt)}
        </Text>
        {usage?.windowLabel ? (
          <Text style={[styles.meta, { color: t.textMuted }]}>
            {usage.windowLabel}
          </Text>
        ) : null}
        {provider.lastError ? (
          <Text style={[styles.error, { color: t.danger }]}>
            {provider.lastError}
          </Text>
        ) : null}

        <PrimaryButton
          label="Refresh from provider"
          variant="tonal"
          onPress={() => refreshProvider(provider.id)}
          loading={refreshingId === provider.id}
          style={{ marginTop: spacing.sm }}
        />
      </Surface>

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

      <Surface variant="card" padded>
        <Text style={[styles.cardTitle, { color: t.text }]}>Manual snapshot</Text>
        <Text style={[styles.help, { color: t.textSecondary }]}>
          Leave cost blank and enter tokens to store a snapshot — the dashboard will
          estimate cost from list rates.
        </Text>
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder="Cost USD (e.g. 12.40)"
          placeholderTextColor={t.textMuted}
          keyboardType="decimal-pad"
          value={cost}
          onChangeText={setCost}
        />
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder="Input tokens"
          placeholderTextColor={t.textMuted}
          keyboardType="number-pad"
          value={inputTok}
          onChangeText={setInputTok}
        />
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder="Output tokens"
          placeholderTextColor={t.textMuted}
          keyboardType="number-pad"
          value={outputTok}
          onChangeText={setOutputTok}
        />
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder="Note (optional)"
          placeholderTextColor={t.textMuted}
          value={note}
          onChangeText={setNote}
        />
        <PrimaryButton
          label="Save snapshot"
          onPress={onManual}
          loading={busy}
          style={{ marginTop: spacing.sm }}
        />
      </Surface>

      <Surface variant="card" padded>
        <Text style={[styles.cardTitle, { color: t.text }]}>Update API key</Text>
        <TextInput
          style={[styles.input, inputStyle]}
          placeholder={def.keyHint}
          placeholderTextColor={t.textMuted}
          secureTextEntry
          autoCapitalize="none"
          value={newKey}
          onChangeText={setNewKey}
        />
        <PrimaryButton
          label="Replace encrypted key"
          variant="outline"
          onPress={onUpdateKey}
          style={{ marginTop: spacing.sm }}
        />
      </Surface>

      <PrimaryButton
        label="Remove provider from this device"
        variant="danger"
        onPress={onDelete}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  back: { fontWeight: '600', fontSize: 16 },
  header: { gap: spacing.sm },
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
  },
  badgeText: { fontWeight: '800', fontSize: 12 },
  title: { fontSize: 28, fontWeight: '800' },
  sub: { fontSize: 14 },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 4,
  },
  help: { fontSize: 13, lineHeight: 18, marginBottom: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  cell: { width: '45%' },
  cellLabel: {
    ...typography.overline,
    fontSize: 11,
  },
  cellValue: {
    fontSize: 20,
    fontWeight: '700',
    marginTop: 2,
  },
  meta: { fontSize: 12, marginTop: 4 },
  estimate: {
    fontSize: 13,
    fontWeight: '600',
    marginTop: 6,
  },
  error: { fontSize: 13, marginTop: 4 },
  input: {
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    marginTop: 8,
  },
});
