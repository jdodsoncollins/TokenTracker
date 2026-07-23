import { Alert, StyleSheet, Text, View } from 'react-native';
import { useApp } from '../app/AppContext';
import { PrimaryButton } from '../components/ui/PrimaryButton';
import { Screen } from '../components/ui/Screen';
import { Surface } from '../components/ui/Surface';
import { getTheme, isMaterialChrome, spacing, typography } from '../theme/tokens';

const PRINCIPLES = [
  {
    title: 'TokenTracker receives no usage',
    body: 'TokenTracker has no backend, telemetry, or accounts. The app records usage snapshots locally, but TokenTracker receives no tokens, prompts, spend, or provider response bodies.',
  },
  {
    title: 'Credentials use platform storage',
    body: 'Native keys persist in OS secure storage through expo-secure-store. TokenTracker does not require biometric authentication or claim secure enclave storage. Web keys stay in memory and disappear on reload.',
  },
  {
    title: 'Network only to your providers',
    body: 'Save and validate and Refresh send your key directly to the selected provider. Custom endpoints require HTTPS except localhost and 127.0.0.1 during local development.',
  },
  {
    title: 'Local usage cache only',
    body: 'Provider labels and usage snapshots live in AsyncStorage. Android backup is disabled, but iOS or platform-managed device backups may include this usage metadata.',
  },
  {
    title: 'Open source (MIT)',
    body: 'Read the code, audit the network calls, or fork it. The MIT License permits personal and commercial use with attribution.',
  },
  {
    title: 'Platform design',
    body: isMaterialChrome
      ? 'On Android, chrome follows Material Design 3 Expressive: tonal surfaces, shape scale, and navigation-bar indicators.'
      : 'On iOS, chrome follows Apple HIG with Liquid Glass-style translucent materials so content stays in focus.',
  },
];

export function PrivacyScreen() {
  const t = getTheme();
  const { wipeEverything, providers } = useApp();

  const onWipe = () => {
    Alert.alert(
      'Erase all local data?',
      `This removes ${providers.length} provider(s), stored keys, and usage history from this device. This cannot be undone.`,
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
          TokenTracker receives no usage.
        </Text>{' '}
        The app stores local usage snapshots for its dashboard.
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
          No accounts · No telemetry · No backend
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
          Save and validate and Refresh call the selected provider directly. TokenTracker
          sends no prompts, provider response bodies, or usage metadata to a TokenTracker
          service. No such service exists.
        </Text>
      </Surface>

      <Surface variant="card" padded>
        <Text style={[styles.cardTitle, { color: t.text }]}>How usage is measured</Text>
        <Text style={[styles.cardBody, { color: t.textSecondary }]}>
          Cumulative readings carry forward and produce deltas only against compatible
          cumulative readings. Period and point readings appear only on the day observed.
          Readings with different windows stay separate. Token cost estimates require an
          explicit model and remain labelled as estimates.
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
