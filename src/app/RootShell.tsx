import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardScreen } from '../screens/DashboardScreen';
import { PrivacyScreen } from '../screens/PrivacyScreen';
import { ProviderDetailScreen } from '../screens/ProviderDetailScreen';
import { ProvidersScreen } from '../screens/ProvidersScreen';
import type { TabId } from '../types';
import { colors, spacing } from '../theme/colors';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Home', icon: '◈' },
  { id: 'providers', label: 'Providers', icon: '◎' },
  { id: 'privacy', label: 'Privacy', icon: '◌' },
];

export function RootShell() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<TabId>('dashboard');
  const [detailId, setDetailId] = useState<string | null>(null);

  if (detailId) {
    return (
      <View style={styles.root}>
        <ProviderDetailScreen
          providerId={detailId}
          onBack={() => setDetailId(null)}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={styles.body}>
        {tab === 'dashboard' && (
          <DashboardScreen
            onOpenPrivacy={() => setTab('privacy')}
            onOpenProviders={() => setTab('providers')}
            onOpenProvider={setDetailId}
          />
        )}
        {tab === 'providers' && (
          <ProvidersScreen onOpenProvider={setDetailId} />
        )}
        {tab === 'privacy' && <PrivacyScreen />}
      </View>

      <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <Pressable
              key={t.id}
              onPress={() => setTab(t.id)}
              style={styles.tab}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.tabIcon, active && styles.tabIconActive]}>
                {t.icon}
              </Text>
              <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  body: {
    flex: 1,
  },
  tabBar: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.bgElevated,
    paddingTop: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: 4,
  },
  tabIcon: {
    color: colors.textMuted,
    fontSize: 16,
  },
  tabIconActive: {
    color: colors.accent,
  },
  tabLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '600',
  },
  tabLabelActive: {
    color: colors.text,
  },
});
