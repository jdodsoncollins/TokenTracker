import { useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useApp } from '../app/AppContext';
import { EmptyState } from '../components/EmptyState';
import { ProviderCard } from '../components/ProviderCard';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { Screen } from '../components/ui/Screen';
import { Surface } from '../components/ui/Surface';
import { PROVIDER_CATALOG, PROVIDER_ORDER } from '../services/providers/catalog';
import type { ProviderKind } from '../types';
import { getTheme, spacing, typography } from '../theme/tokens';

interface Props {
  onOpenProvider: (id: string) => void;
}

export function ProvidersScreen({ onOpenProvider }: Props) {
  const t = getTheme();
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
      Alert.alert(
        'API key required',
        'Paste your provider API key. It stays on this device only.',
      );
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
        Alert.alert(
          result.ok ? 'Provider added' : 'Saved with a warning',
          result.message,
        );
      }
    } catch (e) {
      Alert.alert('Could not save', e instanceof Error ? e.message : 'Unknown error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen keyboard>
      <View style={styles.header}>
        <Text style={[styles.title, { color: t.text }]}>Providers</Text>
        <PrimaryButton
          label={showForm ? 'Close' : '+ Add'}
          variant={showForm ? 'outline' : 'filled'}
          onPress={() => setShowForm((v) => !v)}
          style={styles.addBtn}
        />
      </View>
      <Text style={[styles.subtitle, { color: t.textSecondary }]}>
        Credentials are encrypted offline with the OS secure store. They are never
        written to git, analytics, or any TokenTracker server (there isn’t one).
      </Text>

      {showForm && (
        <Surface variant="card" padded>
          <Text style={[styles.formLabel, { color: t.textMuted }]}>Provider</Text>
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
                    {
                      borderRadius: t.radius.full,
                      borderColor: active ? d.color : t.border,
                      backgroundColor: active ? d.color + '22' : t.bgElevated,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: active ? d.color : t.textSecondary,
                      fontWeight: '600',
                      fontSize: 13,
                    }}
                  >
                    {d.shortName}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>

          <Text style={[styles.hint, { color: t.textSecondary }]}>{def.usageHint}</Text>

          <Text style={[styles.formLabel, { color: t.textMuted }]}>Label</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: t.bgElevated,
                borderColor: t.border,
                color: t.text,
                borderRadius: t.radius.md,
              },
            ]}
            placeholder={def.name}
            placeholderTextColor={t.textMuted}
            value={label}
            onChangeText={setLabel}
            autoCapitalize="words"
          />

          <Text style={[styles.formLabel, { color: t.textMuted }]}>API key</Text>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: t.bgElevated,
                borderColor: t.border,
                color: t.text,
                borderRadius: t.radius.md,
              },
            ]}
            placeholder={def.keyHint}
            placeholderTextColor={t.textMuted}
            value={apiKey}
            onChangeText={setApiKey}
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry
            textContentType="password"
          />

          {kind === 'custom' && (
            <>
              <Text style={[styles.formLabel, { color: t.textMuted }]}>Base URL</Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: t.bgElevated,
                    borderColor: t.border,
                    color: t.text,
                    borderRadius: t.radius.md,
                  },
                ]}
                placeholder="https://api.example.com/v1"
                placeholderTextColor={t.textMuted}
                value={baseUrl}
                onChangeText={setBaseUrl}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </>
          )}

          <PrimaryButton
            label="Save encrypted key"
            onPress={onSubmit}
            loading={busy}
            style={{ marginTop: spacing.md }}
          />
        </Surface>
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
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    ...typography.largeTitle,
    fontSize: 28,
  },
  subtitle: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: -4,
  },
  addBtn: {
    minHeight: 40,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  formLabel: {
    ...typography.overline,
    marginTop: spacing.sm,
    marginBottom: 6,
  },
  chips: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    marginVertical: spacing.sm,
  },
  input: {
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === 'ios' ? 14 : 10,
    fontSize: 15,
    marginBottom: 4,
  },
  list: { gap: spacing.md },
});
