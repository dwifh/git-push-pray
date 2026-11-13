import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';
import { View } from 'react-native';
import { FONT, glow, useTheme } from '@/components/theme';

// JS tabs, not NativeTabs: the demo target is the web PWA only.
export default function RootLayout() {
  const t = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.teal,
        tabBarInactiveTintColor: t.muted,
        tabBarStyle: { backgroundColor: t.card, borderTopColor: t.border, minHeight: 72, paddingTop: 6 },
        tabBarLabelStyle: { fontFamily: FONT.body, fontSize: 14, fontWeight: '700' },
        headerStyle: { backgroundColor: t.bg },
        headerTintColor: t.text,
        sceneStyle: { backgroundColor: t.bg },
      }}>
      <Tabs.Screen name="home" options={{ title: 'Home', headerShown: false, tabBarIcon: ({ color }) => <Ionicons name="home" size={26} color={color as string} /> }} />
      <Tabs.Screen
        name="index"
        options={{
          title: 'Scan',
          // The orange scan button from the design; the word stays below it.
          tabBarIcon: () => (
            <View style={[{ width: 40, height: 28, borderRadius: 10, backgroundColor: t.orange, alignItems: 'center', justifyContent: 'center' }, glow(t.orange, 14)]}>
              <Ionicons name="scan" size={20} color={t.onOrange} />
            </View>
          ),
        }}
      />
      <Tabs.Screen name="coach" options={{ title: 'Coach', headerShown: false, tabBarIcon: ({ color }) => <Ionicons name="call" size={26} color={color as string} /> }} />
      <Tabs.Screen name="feed" options={{ title: 'Feed', headerShown: false, tabBarIcon: ({ color }) => <Ionicons name="people" size={26} color={color as string} /> }} />
      <Tabs.Screen name="email" options={{ title: 'Email', tabBarIcon: ({ color }) => <Ionicons name="mail" size={26} color={color as string} /> }} />
    </Tabs>
  );
}
