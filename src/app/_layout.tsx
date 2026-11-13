import { Tabs } from 'expo-router/js-tabs';
import { useTheme } from '@/shared/theme';

// JS tabs, not NativeTabs: the demo target is the web PWA only.
export default function RootLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: t.bg },
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border, height: 64 },
        tabBarActiveTintColor: t.teal,
        tabBarInactiveTintColor: t.muted,
        tabBarLabelStyle: { fontSize: 14, fontWeight: '700' },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Scan' }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach' }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="email" options={{ title: 'Email' }} />
    </Tabs>
  );
}
