import { Tabs } from 'expo-router/js-tabs';

// JS tabs, not NativeTabs: the demo target is the web PWA only.
export default function RootLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Scan' }} />
      <Tabs.Screen name="coach" options={{ title: 'Coach', headerShown: false }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed', headerShown: false }} />
      <Tabs.Screen name="email" options={{ title: 'Email' }} />
    </Tabs>
  );
}
