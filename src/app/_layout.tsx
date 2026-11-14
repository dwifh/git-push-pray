import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { useEffect, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { FONT, RADIUS, css, useTheme, useThemeMode } from '@/components/theme';
import type { IconName } from '@/components/ui';
import { useProfile } from '@/components/useProfile';

// Scan is the app's start page (manifest start_url) and where a hidden tab sends the person (Elder mode, below).
export const unstable_settings = { anchor: 'index' };

// A CSS media query as React state. The server always renders "no match" (phone layout, motion on), then the browser corrects it.
function useMedia(query: string) {
  return useSyncExternalStore(
    (fn) => {
      const m = globalThis.matchMedia?.(query);
      m?.addEventListener('change', fn);
      return () => m?.removeEventListener('change', fn);
    },
    () => !!globalThis.matchMedia?.(query).matches,
    () => false,
  );
}

// The active tab is shown by a filled icon and bolder colour, not by colour alone.
const icon = (name: IconName) => function TabIcon({ color, focused }: { color: unknown; focused: boolean }) {
  return <Ionicons name={focused ? name : (`${name}-outline` as IconName)} size={24} color={color as string} />;
};

// JS tabs, not NativeTabs: the demo target is the web PWA only.
export default function RootLayout() {
  const t = useTheme();
  const [mode] = useThemeMode();
  // Wide screens (tablet landscape, laptop) get the tabs as a left sidebar.
  const wide = useMedia('(min-width: 900px)');
  const calm = useMedia('(prefers-reduced-motion: reduce)');
  // Elder mode (PLAN §7.3): only Scan and Coach. A hidden tab that is open sends the person to Scan.
  const hide = useProfile()?.role === 'elder' ? ({ href: null } as const) : {};

  // Outside the React tree: page colour behind overscroll, native scrollbars/inputs, and the keyboard focus ring.
  useEffect(() => {
    const root = globalThis.document?.documentElement.style;
    if (!root) return;
    root.backgroundColor = t.bg;
    root.colorScheme = mode;
    root.setProperty('--focus', t.teal);
  }, [t, mode]);

  return (
    <Tabs
      backBehavior="initialRoute" // Back goes to Scan, the anchor above
      screenOptions={{
        tabBarPosition: wide ? 'left' : 'bottom',
        tabBarVariant: wide ? 'material' : 'uikit',
        tabBarLabelPosition: wide ? 'beside-icon' : 'below-icon',
        tabBarActiveTintColor: t.teal,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: wide
          ? { backgroundColor: t.card, borderRightColor: t.border, borderRightWidth: 1, minWidth: 220, paddingTop: 20 }
          : [{ backgroundColor: t.glass, borderTopColor: t.border, borderTopWidth: 1, minHeight: 68, paddingTop: 6, overflow: 'visible' }, css({ backdropFilter: 'blur(14px)', WebkitBackdropFilter: 'blur(14px)' })],
        tabBarLabelStyle: { fontFamily: FONT.body, fontSize: wide ? 16 : 13, fontWeight: '600' },
        // No cross-fade for people who asked their phone for less motion.
        animation: calm ? 'none' : 'fade',
        headerShown: false, // every page draws its own header (ui.tsx Header)
        sceneStyle: { backgroundColor: t.bg },
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home', tabBarIcon: icon('home'), ...hide }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach', tabBarIcon: icon('call') }} />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scan',
          // The one solid-colour item in the bar: checking a message is the app's main job. The word stays below it.
          tabBarIcon: () => (
            // On phones it sits raised above the bar, ringed in the page colour so it reads as a floating button.
            <View style={[
              { width: wide ? 28 : 52, height: wide ? 28 : 52, borderRadius: wide ? RADIUS.sm : 26, backgroundColor: t.orange, alignItems: 'center', justifyContent: 'center' },
              !wide && { marginTop: -22, borderWidth: 4, borderColor: t.bg },
              css({ backgroundImage: t.gradOrange, boxShadow: wide ? 'none' : `0 10px 24px -6px ${t.glowOrange}` }),
            ]}>
              <Ionicons name="scan" size={wide ? 16 : 24} color={t.onOrange} />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="feed" options={{ title: 'Feed', tabBarIcon: icon('people'), ...hide }} />
      <Tabs.Screen name="email" options={{ title: 'Email', tabBarIcon: icon('mail'), ...hide }} />
    </Tabs>
  );
}
