import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../app/AppContext';
import { colors, radius, spacing } from '../theme/colors';

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
];

export function PrivacyScreen() {
  const insets = useSafeAreaInsets();
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
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{
        paddingTop: insets.top + spacing.lg,
        paddingBottom: 120,
        paddingHorizontal: spacing.lg,
        gap: spacing.lg,
      }}
    >
      <Text style={styles.kicker}>TRANSPARENCY</Text>
      <Text style={styles.title}>Privacy & data</Text>
      <Text style={styles.lead}>
        Simple promise: <Text style={styles.emph}>zero usage is ever recorded</Text> by
        TokenTracker. Your machine is the only place that holds secrets and history.
      </Text>

      <View style={styles.badge}>
        <Text style={styles.badgeText}>No accounts · No telemetry · No cloud sync</Text>
      </View>

      {PRINCIPLES.map((p) => (
        <View key={p.title} style={styles.card}>
          <Text style={styles.cardTitle}>{p.title}</Text>
          <Text style={styles.cardBody}>{p.body}</Text>
        </View>
      ))}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>What leaves the device</Text>
        <Text style={styles.cardBody}>
          Only requests you initiate to LLM providers you configure (for key validation
          and usage endpoints). Request bodies never include your chat prompts — this app
          does not chat; it only tracks usage metadata you choose to pull or enter.
        </Text>
      </View>

      <Pressable style={styles.dangerBtn} onPress={onWipe}>
        <Text style={styles.dangerBtnText}>Wipe all local data</Text>
      </Pressable>

      <Text style={styles.footer}>
        MIT License · github.com/jdodsoncollins/TokenTracker
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  kicker: {
    color: colors.privacy,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.6,
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginTop: -8,
  },
  lead: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  emph: {
    color: colors.privacy,
    fontWeight: '700',
  },
  badge: {
    alignSelf: 'flex-start',
    backgroundColor: colors.privacySoft,
    borderColor: 'rgba(61, 220, 151, 0.3)',
    borderWidth: 1,
    borderRadius: radius.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  badgeText: {
    color: colors.privacy,
    fontWeight: '700',
    fontSize: 12,
  },
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
  },
  cardBody: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  dangerBtn: {
    borderWidth: 1,
    borderColor: colors.danger,
    backgroundColor: colors.dangerSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  dangerBtnText: {
    color: colors.danger,
    fontWeight: '700',
  },
  footer: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.sm,
  },
});
