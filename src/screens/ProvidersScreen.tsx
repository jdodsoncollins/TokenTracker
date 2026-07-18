import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
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
import { EmptyState } from '../components/EmptyState';
import { ProviderCard } from '../components/ProviderCard';
import { PROVIDER_CATALOG, PROVIDER_ORDER } from '../services/providers/catalog';
import type { ProviderKind } from '../types';
import { colors, radius, spacing } from '../theme/colors';

interface Props {
  onOpenProvider: (id: string) => void;
}

export function ProvidersScreen({ onOpenProvider }: Props) {
  const insets = useSafeAreaInsets();
  const { providers, addProvider, refreshProvider, refreshingId } = useApp();

  const [kind, setKind] = useState<ProviderKind>('openai');
  const [label, setLabel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [showForm, setShowForm] = useState(providers.length === 0);

  const def = PROVIDER_CATALOG[kind];

  const onSubmit = async () => {
    if (!apiKey.trim() && kind !== 'custom') {
      Alert.alert('API key required', 'Paste your provider API key. It stays on this device only.');
      return;
    }
    setBusy(true);
    try {
      const result = await addProvider({
        kind,
        label: label || def.name,
        apiKey,
        baseUrl: kind === 'custom' ? baseUrl : undefined,
      });
      setApiKey('');
      setLabel('');
      setBaseUrl('');
      setShowForm(false);
      if (result.message) {
        Alert.alert(result.ok ? 'Provider added' : 'Saved with a warning', result.message);
      }
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + spacing.lg, paddingBottom: 120 },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Providers</Text>
          <Pressable
            style={styles.addBtn}
            onPress={() => setShowForm((v) => !v)}
          >
            <Text style={styles.addBtnText}>{showForm ? 'Close' : '+ Add'}</Text>
          </Pressable>
        </View>
        <Text style={styles.subtitle}>
          Credentials are encrypted offline with the OS secure store. They are never
          written to git, analytics, or any TokenTracker server (there isn’t one).
        </Text>

        {showForm && (
          <View style={styles.form}>
            <Text style={styles.formLabel}>Provider</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {PROVIDER_ORDER.map((k) => {
                const d = PROVIDER_CATALOG[k];
                const active = k === kind;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKind(k)}
                    style={[
                      styles.chip,
                      active && { borderColor: d.color, backgroundColor: d.color + '22' },
                    ]}
                  >
                    <Text style={[styles.chipText, active && { color: d.color }]}>
                      {d.shortName}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            <Text style={styles.hint}>{def.usageHint}</Text>

            <Text style={styles.formLabel}>Label</Text>
            <TextInput
              style={styles.input}
              placeholder={def.name}
              placeholderTextColor={colors.textMuted}
              value={label}
              onChangeText={setLabel}
              autoCapitalize="words"
            />

            <Text style={styles.formLabel}>API key</Text>
            <TextInput
              style={styles.input}
              placeholder={def.keyHint}
              placeholderTextColor={colors.textMuted}
              value={apiKey}
              onChangeText={setApiKey}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry
              textContentType="password"
            />

            {kind === 'custom' && (
              <>
                <Text style={styles.formLabel}>Base URL</Text>
                <TextInput
                  style={styles.input}
                  placeholder="https://api.example.com/v1"
                  placeholderTextColor={colors.textMuted}
                  value={baseUrl}
                  onChangeText={setBaseUrl}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </>
            )}

            <Pressable
              style={[styles.submit, busy && styles.submitDisabled]}
              onPress={onSubmit}
              disabled={busy}
            >
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitText}>Save encrypted key</Text>
              )}
            </Pressable>
          </View>
        )}

        {providers.length === 0 && !showForm ? (
          <EmptyState
            title="Nothing configured"
            body="Add OpenAI, Anthropic, Grok, or another provider to start tracking."
          />
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
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    paddingHorizontal: spacing.lg,
    gap: spacing.lg,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
    marginTop: -8,
  },
  addBtn: {
    backgroundColor: colors.accent,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm + 2,
    borderRadius: radius.full,
  },
  addBtnText: {
    color: '#fff',
    fontWeight: '700',
  },
  form: {
    backgroundColor: colors.bgCard,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  formLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.7,
    marginTop: spacing.sm,
  },
  chips: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.bgElevated,
  },
  chipText: {
    color: colors.textSecondary,
    fontWeight: '600',
    fontSize: 13,
  },
  hint: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginVertical: spacing.sm,
  },
  input: {
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    color: colors.text,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
  },
  submit: {
    marginTop: spacing.md,
    backgroundColor: colors.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  submitDisabled: { opacity: 0.6 },
  submitText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  list: { gap: spacing.md },
});
