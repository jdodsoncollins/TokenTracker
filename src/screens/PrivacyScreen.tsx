import { Alert, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../app/AppContext';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { Screen } from '../components/ui/Screen';
import { Surface } from '../components/ui/Surface';
import { getTheme, isMaterialChrome, spacing, typography } from '../theme/tokens';

const PRINCIPLES = [
  {
    title: 'Zero usage recorded by us',
    body: 'TokenTracker has no backend, no analytics SDK, no crash reporter that uploads content, and no account system. We cannot see your tokens, prompts, or spend — because nothing is sent to us.',
  },
  {
    title: 'Credentials stay offline & encrypted',
    body: 'API keys are stored with expo-secure-store (iOS Keychain / Android Keystore). On web dev builds, keys are AES-GCM encrypted with a local master key. Keys are never written to AsyncStorage, logs, or source control.',
  },
  {
    title: 'Network only to your providers',
    body: 'When you tap Refresh, the app calls OpenAI, Anthropic, xAI, OpenRouter, Google, or your custom base URL — directly over HTTPS. There is no proxy through TokenTracker infrastructure.',
  },
  {
    title: 'Local usage cache only',
    body: 'Usage snapshots live in on-device AsyncStorage so the dashboard works offline. You can wipe everything from this screen.',
  },
  {
    title: 'Open source (MIT)',
    body: 'Read the code. Audit the network calls. Fork it. The license is MIT — free for personal and commercial use with attribution.',
  },
  {
    title: 'Platform design',
    body: isMaterialChrome
      ? 'On Android, chrome follows Material Design 3 Expressive: tonal surfaces, shape scale, and navigation-bar indicators.'
      : 'On iOS, chrome follows Apple HIG with Liquid Glass–style translucent materials so content stays in focus.',
  },
];

export function PrivacyScreen() {
  const t = getTheme();
  const { wipeEverything, providers } = useApp();

  const onWipe = () => {
    Alert.alert(
      'Erase all local data?',
      `This removes ${providers.length} provider(s), encrypted keys, and usage history from this device. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase everything',
          style: 'destructive',
          onPress: () => wipeEverything(),
        },
      ],
    );
  };

  return (
    <Screen>
      <Text style={[styles.kicker, { color: t.privacy }]}>TRANSPARENCY</Text>
      <Text style={[styles.title, { color: t.text }]}>Privacy & data</Text>
      <Text style={[styles.lead, { color: t.textSecondary }]}>
        Simple promise:{' '}
        <Text style={{ color: t.privacy, fontWeight: '700' }}>
          zero usage is ever recorded
        </Text>{' '}
        by TokenTracker. Your machine is the only place that holds secrets and history.
      </Text>

      <View
        style={[
          styles.badge,
          {
            backgroundColor: t.privacySoft,
            borderColor: 'rgba(61, 220, 151, 0.3)',
            borderRadius: t.radius.full,
          },
        ]}
      >
        <Text style={[styles.badgeText, { color: t.privacy }]}>
          No accounts · No telemetry · No cloud sync
        </Text>
      </View>

      {PRINCIPLES.map((p) => (
        <Surface key={p.title} variant="card" padded>
          <Text style={[styles.cardTitle, { color: t.text }]}>{p.title}</Text>
          <Text style={[styles.cardBody, { color: t.textSecondary }]}>{p.body}</Text>
        </Surface>
      ))}

      <Surface variant="card" padded>
        <Text style={[styles.cardTitle, { color: t.text }]}>What leaves the device</Text>
        <Text style={[styles.cardBody, { color: t.textSecondary }]}>
          Only requests you initiate to LLM providers you configure (for key validation
          and usage endpoints). Request bodies never include your chat prompts — this app
          does not chat; it only tracks usage metadata you choose to pull or enter.
        </Text>
      </Surface>

      <PrimaryButton
        label="Wipe all local data"
        variant="danger"
        onPress={onWipe}
      />

      <Text style={[styles.footer, { color: t.textMuted }]}>
        MIT License · github.com/jdodsoncollins/TokenTracker
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  kicker: {
    ...typography.overline,
    letterSpacing: 1.6,
  },
  title: {
    ...typography.largeTitle,
    fontSize: 28,
    marginTop: -8,
  },
  lead: {
    fontSize: 15,
    lineHeight: 22,
  },
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  badgeText: {
    fontWeight: '700',
    fontSize: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 6,
  },
  cardBody: {
    fontSize: 14,
    lineHeight: 21,
  },
  footer: {
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
