import { BlurView } from 'expo-blur';
import { useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DashboardScreen } from '../screens/DashboardScreen';
import { PrivacyScreen } from '../screens/PrivacyScreen';
import { ProviderDetailScreen } from '../screens/ProviderDetailScreen';
import { ProvidersScreen } from '../screens/ProvidersScreen';
import type { TabId } from '../types';
import {
  getTheme,
  isAppleChrome,
  isMaterialChrome,
  spacing,
} from '../theme/tokens';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'dashboard', label: 'Home', icon: '◈' },
  { id: 'providers', label: 'Providers', icon: '◎' },
  { id: 'privacy', label: 'Privacy', icon: '◌' },
];

/**
 * Navigation chrome:
 * - iOS: floating Liquid Glass–style tab bar (HIG / Liquid Glass)
 * - Android: Material 3 navigation bar with active indicator pill
 */
export function RootShell() {
  const insets = useSafeAreaInsets();
  const t = getTheme();
  const [tab, setTab] = useState<TabId>('dashboard');
  const [detailId, setDetailId] = useState<string | null>(null);

  if (detailId) {
    return (
      <View style={[styles.root, { backgroundColor: t.bg }]}>
        <ProviderDetailScreen
          providerId={detailId}
          onBack={() => setDetailId(null)}
        />
      </View>
    );
  }

  const floating = t.tabBar.floating;
  const bottomInset = Math.max(insets.bottom, floating ? 8 : 10);

  const tabItems = TABS.map((item) => {
    const active = tab === item.id;
    return (
      <Pressable
        key={item.id}
        onPress={() => setTab(item.id)}
        style={styles.tab}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={item.label}
        android_ripple={
          isMaterialChrome
            ? { color: 'rgba(180,167,255,0.15)', borderless: true, radius: 36 }
            : undefined
        }
      >
        {isMaterialChrome && active ? (
          <View
            style={[
              styles.m3Indicator,
              { backgroundColor: t.accentSoft },
            ]}
          >
            <Text style={[styles.tabIcon, { color: t.accent }]}>{item.icon}</Text>
          </View>
        ) : (
          <Text
            style={[
              styles.tabIcon,
              { color: active ? t.accent : t.textMuted },
              isAppleChrome && active && styles.tabIconAppleActive,
            ]}
          >
            {item.icon}
          </Text>
        )}
        <Text
          style={[
            styles.tabLabel,
            {
              color: active ? (isMaterialChrome ? t.accent : t.text) : t.textMuted,
              fontWeight: active ? '700' : '600',
            },
          ]}
        >
          {item.label}
        </Text>
      </Pressable>
    );
  });

  return (
    <View style={[styles.root, { backgroundColor: t.bg }]}>
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

      <View
        pointerEvents="box-none"
        style={[
          styles.tabBarHost,
          floating
            ? {
                left: t.tabBar.margin,
                right: t.tabBar.margin,
                bottom: bottomInset,
              }
            : {
                left: 0,
                right: 0,
                bottom: 0,
                paddingBottom: bottomInset,
                borderTopWidth: StyleSheet.hairlineWidth,
                borderTopColor: t.border,
                backgroundColor: t.bgElevated,
                ...t.shadow.chrome,
              },
        ]}
      >
        {floating ? (
          <View
            style={[
              styles.floatingShell,
              {
                borderRadius: t.radius.xl,
                borderColor: t.glassBorder,
                height: t.tabBar.height,
                ...t.shadow.chrome,
              },
            ]}
          >
            {Platform.OS === 'ios' ? (
              <BlurView
                intensity={t.blurIntensity}
                tint={t.blurTint}
                style={StyleSheet.absoluteFill}
              />
            ) : (
              <View
                style={[
                  StyleSheet.absoluteFill,
                  {
                    backgroundColor: t.glassStrong,
                    // @ts-expect-error web backdrop
                    backdropFilter: Platform.OS === 'web' ? 'blur(24px)' : undefined,
                  },
                ]}
              />
            )}
            <View style={styles.floatingRim} pointerEvents="none" />
            <View style={styles.tabRow}>{tabItems}</View>
          </View>
        ) : (
          <View style={[styles.tabRow, { minHeight: t.tabBar.height - 8 }]}>
            {tabItems}
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  body: {
    flex: 1,
  },
  tabBarHost: {
    position: 'absolute',
    zIndex: 20,
  },
  floatingShell: {
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth * 2,
    backgroundColor: 'rgba(18, 24, 38, 0.45)',
  },
  floatingRim: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.1)',
    borderRadius: 28,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: spacing.sm,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingVertical: 8,
    minHeight: 48,
  },
  tabIcon: {
    fontSize: 17,
  },
  tabIconAppleActive: {
    textShadowColor: 'rgba(124, 108, 255, 0.55)',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 8,
  },
  tabLabel: {
    fontSize: 11,
  },
  m3Indicator: {
    paddingHorizontal: 18,
    paddingVertical: 4,
    borderRadius: 18,
    marginBottom: 2,
  },
});
