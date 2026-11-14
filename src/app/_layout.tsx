import { Tabs } from 'expo-router/js-tabs';

// JS tabs, not NativeTabs: one layout for the web PWA and the Android app.
export default function RootLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Scan' }} />
      <Tabs.Screen name="expo-sharing" options={{ href: null }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach' }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed' }} />
      <Tabs.Screen name="email" options={{ title: 'Email' }} />
    </Tabs>
  );
}
