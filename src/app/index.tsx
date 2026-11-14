import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, type Href } from 'expo-router';
import { useEffect, useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONT, css, glow, useTheme } from '@/components/theme';
import { Screen, ThemeToggle, type IconName } from '@/components/ui';
import { api } from '@/shared/api';
import { getContact } from '@/shared/contact';
import { toTrending } from '@/shared/feed';
import type { Trending } from '@/shared/types';

const noSubscribe = () => () => {};
const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

// Welcome page: the four features, plus this week's Feed numbers. Uses only data the app already has.
export default function Home() {
  const t = useTheme();
  // The server renders "Hello" and no name; the phone fills in its clock and saved name (no hydration mismatch).
  const greeting = useSyncExternalStore(noSubscribe, greet, () => 'Hello');
  const name = useSyncExternalStore(noSubscribe, () => getContact().firstName, () => '');
  const [data, setData] = useState<Trending | null>();

  useEffect(() => {
    let live = true;
    api<unknown>('/api/reports')
      .then((d) => live && setData(toTrending(d)))
      .catch(() => live && setData(null)); // the snapshot just shows dashes; Home never blocks on the network
    return () => { live = false; };
  }, []);

  const n = (x?: number) => (data ? String(x ?? 0) : '–');
  const features: { href: Href; icon: IconName; title: string; text: string; color: string; soft: string }[] = [
    // Tile colours are fixed (not themed) so the white icon stays ≥ 4.5:1 in both modes.
    { href: '/scan', icon: 'scan', title: 'Scam Shield', text: 'Check messages, links or senders for scams', color: '#0B7A66', soft: t.tealSoft },
    { href: '/coach', icon: 'call', title: 'Elder Call Coach', text: 'Answer a few questions during a suspicious call', color: '#C2410C', soft: t.orangeSoft },
    { href: '/feed', icon: 'bar-chart', title: 'Scam Feed', text: 'See recent scam reports across Mauritius', color: t.purple, soft: t.purpleSoft },
    { href: '/email', icon: 'mail', title: 'Email Guard', text: 'Check email headers or .eml files for phishing', color: '#2B4FD6', soft: t.blueSoft },
  ];

  return (
    <Screen>
      <View style={s.top}>
        <View style={[s.logo, { backgroundColor: '#0B7A66' }, glow(t.teal, 18)]}>
          <Ionicons name="shield-checkmark" size={26} color="#FFFFFF" />
        </View>
        <Text style={[s.brand, { color: t.text }]}>ScamGuard</Text>
        <ThemeToggle />
      </View>

      <View style={[s.hero, css({ backgroundImage: `radial-gradient(ellipse 70% 120% at 100% 50%, ${t.teal}33, transparent 70%)` })]}>
        <Text style={[s.greeting, { color: t.muted }]}>{name ? `${greeting}, ${name} 👋` : `${greeting} 👋`}</Text>
        <Text accessibilityRole="header" style={[s.title, { color: t.text }]}>Stay safe from scams</Text>
      </View>

      {features.map((f) => (
        <Link key={f.title} href={f.href} asChild>
          {/* Link needs one flat style on its child (expo-router Slot). */}
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={`${f.title}. ${f.text}`}
            style={StyleSheet.flatten([s.feature, { backgroundColor: f.soft, borderColor: t.border }])}>
            <View style={[s.icon, { backgroundColor: f.color }, css({ backgroundImage: `linear-gradient(150deg, ${f.color}cc, ${f.color})` }), glow(f.color, 14)]}>
              <Ionicons name={f.icon} size={30} color="#FFFFFF" />
            </View>
            <View style={{ flex: 1, gap: 3 }}>
              <Text style={[s.fTitle, { color: t.text }]}>{f.title}</Text>
              <Text style={[s.fText, { color: t.muted }]}>{f.text}</Text>
            </View>
            <Ionicons name="chevron-forward" size={24} color={t.muted} />
          </Pressable>
        </Link>
      ))}

      {/* Information only: not a button. */}
      <View
        accessible
        accessibilityLabel={data ? `Mauritius Scam Snapshot: ${n(data.byInstitution.reduce((a, r) => a + r.count, 0))} reports this week, ${n(data.topDomains.length)} fake websites, ${n(data.byInstitution.length)} names copied.` : 'Mauritius Scam Snapshot.'}
        style={[s.snap, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={s.snapHead}>
          <Ionicons name="location" size={26} color={t.teal} />
          <Text style={[s.snapTitle, { color: t.text }]}>Mauritius Scam Snapshot</Text>
        </View>
        <View style={s.stats}>
          <Stat n={n(data?.byInstitution.reduce((a, r) => a + r.count, 0))} label="reports this week" color={t.teal} />
          <View style={[s.divider, { backgroundColor: t.border }]} />
          <Stat n={n(data?.topDomains.length)} label="fake websites" color={t.orange} />
          <View style={[s.divider, { backgroundColor: t.border }]} />
          <Stat n={n(data?.byInstitution.length)} label="names copied" color={t.blue} />
        </View>
        {data === null && <Text style={[s.fText, { color: t.muted }]}>Numbers will show when you are online.</Text>}
      </View>
    </Screen>
  );
}

function Stat({ n, label, color }: { n: string; label: string; color: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, gap: 2 }}>
      <Text style={[s.statN, { color }]}>{n}</Text>
      <Text style={[s.statLabel, { color: t.muted }]}>{label}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: FONT.display, fontSize: 28, fontWeight: '700', flex: 1, letterSpacing: -0.4 },
  hero: { gap: 4, paddingVertical: 8, marginHorizontal: -16, paddingHorizontal: 16 },
  greeting: { fontFamily: FONT.body, fontSize: 19 },
  title: { fontFamily: FONT.display, fontSize: 32, lineHeight: 38, fontWeight: '700', letterSpacing: -0.6 },
  feature: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 24, padding: 14, minHeight: 92 },
  icon: { width: 60, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  fTitle: { fontFamily: FONT.display, fontSize: 21, fontWeight: '700' },
  fText: { fontFamily: FONT.body, fontSize: 16, lineHeight: 22 },
  snap: { borderWidth: 1, borderRadius: 24, padding: 16, gap: 14 },
  snapHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  snapTitle: { fontFamily: FONT.display, fontSize: 19, fontWeight: '700', flex: 1 },
  stats: { flexDirection: 'row', alignItems: 'stretch', gap: 10 },
  divider: { width: 1 },
  statN: { fontFamily: FONT.display, fontSize: 32, fontWeight: '700' },
  statLabel: { fontFamily: FONT.body, fontSize: 15, lineHeight: 20 },
});
