import { Tabs } from 'expo-router/js-tabs';

// JS tabs, not NativeTabs: the demo target is the web PWA only.
export default function RootLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Scan' }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach' }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="email" options={{ title: 'Email' }} />
    </Tabs>
  );
}
