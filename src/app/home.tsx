import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, type Href } from 'expo-router';
import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Helper } from '@/components/Helper';
import { Setup } from '@/components/Setup';
import { FONT, RADIUS, css, useTheme } from '@/components/theme';
import { CountUp, DECOR, Eyebrow, Menu, MenuRow, Screen, ThemeToggle, type IconName } from '@/components/ui';
import { api } from '@/shared/api';
import { getContact } from '@/shared/contact';
import { toTrending } from '@/shared/feed';
import type { Trending } from '@/shared/types';

const noSubscribe = () => () => {};
const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

// Welcome page, bento layout: checking a message is the one big tile; the other tools sit in a 2×2 grid.
// Uses only data the app already has.
export default function Home() {
  const t = useTheme();
  // The server renders "Hello" and no name; the phone fills in its clock and saved name (no hydration mismatch).
  const greeting = useSyncExternalStore(noSubscribe, greet, () => 'Hello');
  const name = useSyncExternalStore(noSubscribe, () => getContact().firstName, () => '');
  const [data, setData] = useState<Trending | null>();
  const [page, setPage] = useState<'helper' | 'setup'>();

  useEffect(() => {
    let live = true;
    api<unknown>('/api/reports')
      .then((d) => live && setData(toTrending(d)))
      .catch(() => live && setData(null)); // the numbers just show dashes; Home never blocks on the network
    return () => { live = false; };
  }, []);

  if (page === 'helper') return <Helper onDone={() => setPage(undefined)} />;
  // If Elder mode was switched on, this tab is now hidden and the tabs layout sends the person to Scan.
  if (page === 'setup') return <Setup onDone={() => setPage(undefined)} />;

  const n = (x?: number) => (data ? String(x ?? 0) : '–');
  const total = data?.byInstitution.reduce((a, r) => a + r.count, 0);

  return (
    <Screen>
      <View style={s.top}>
        <View style={[s.logo, { backgroundColor: t.teal }, css({ backgroundImage: t.gradTeal, boxShadow: `0 0 18px ${t.glowTeal}` })]}>
          <Ionicons name="shield-checkmark" size={24} color={t.onTeal} />
        </View>
        <Text style={[s.brand, { color: t.text }]}>ScamGuard</Text>
        <ThemeToggle />
      </View>

      <View style={{ gap: 4 }}>
        <Text style={[s.greeting, { color: t.muted }]}>{name ? `${greeting}, ${name}` : greeting}</Text>
        <Text accessibilityRole="header" style={[s.title, { color: t.text }]}>Stay safe from scams</Text>
      </View>

      {/* The main job: one big orange tile. */}
      <Link href="/" asChild>
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Check a message. Paste an SMS, WhatsApp or email text."
          style={StyleSheet.flatten([s.big, { backgroundColor: t.orange }, css({ backgroundImage: t.gradOrange, boxShadow: `0 22px 40px -20px ${t.glowOrange}` })])}>
          <View {...DECOR} style={s.ringBox}>
            {[0, 1.3].map((d) => (
              <View key={d} style={[s.ring, { borderColor: t.onOrange }, css({ animation: `ripple 2.6s ease-out ${d}s infinite` })]} />
            ))}
            <View style={[s.ringCore, { backgroundColor: `${t.onOrange}22` }]}>
              <Ionicons name="scan" size={28} color={t.onOrange} />
            </View>
          </View>
          <Eyebrow color={t.onOrange}>Got a strange message?</Eyebrow>
          <Text style={[s.bigTitle, { color: t.onOrange }]}>Check a message</Text>
          <Text style={[s.bigText, { color: t.onOrange }]}>Paste an SMS, WhatsApp or email text.</Text>
          <View style={[s.go, { backgroundColor: t.onOrange }]}>
            <Text style={[s.goText, { color: t.orange }]}>Check now</Text>
            <Ionicons name="arrow-forward" size={18} color={t.orange} />
          </View>
        </Pressable>
      </Link>

      <View style={s.grid}>
        <View style={s.gridRow}>
          <Tile href="/coach" icon="call" color={t.teal} soft={t.tealSoft} title="Call Coach" text="On a strange call?" />
          <Tile href="/feed" icon="bar-chart" color={t.purple} soft={t.purpleSoft} title={data ? `${n(total)} reports` : 'Scam Feed'} text="this week in Mauritius"
            badge={
              <View style={s.live}>
                <View style={[s.dot, { backgroundColor: t.orange }, css({ animation: 'blink 1.4s ease-in-out infinite' })]} />
                <Text style={[s.liveText, { color: t.orange }]}>LIVE</Text>
              </View>
            } />
        </View>
        <View style={s.gridRow}>
          <Tile href="/email" icon="mail" color={t.blue} soft={t.blueSoft} title="Email Guard" text="Check for phishing" />
          <Tile onPress={() => setPage('helper')} icon="key" color={t.text} soft={t.cardHi} title="Help someone" text="Enter their code" />
        </View>
      </View>

      {/* Information only: not a button. */}
      <View
        accessible
        accessibilityLabel={data ? `This week: ${n(data.topDomains.length)} fake websites, ${n(data.byInstitution.length)} names copied.` : 'This week in Mauritius.'}
        style={[s.strip, { backgroundColor: t.card, borderColor: t.border }, css({ boxShadow: t.shadow })]}>
        <Ionicons name="trending-up" size={22} color={t.orange} />
        <Text style={[s.stripText, { color: t.muted }]}>
          <CountUp n={n(data?.topDomains.length)} style={[s.stripN, { color: t.text }]} /> fake websites ·{' '}
          <CountUp n={n(data?.byInstitution.length)} style={[s.stripN, { color: t.text }]} /> names copied this week
        </Text>
      </View>
      {data === null && <Text style={[s.note, { color: t.muted }]}>Numbers will show when you are online.</Text>}

      <Menu>
        <MenuRow icon="settings-outline" title="Phone setup" text="For you, or for someone you help" onPress={() => setPage('setup')} />
      </Menu>
    </Screen>
  );
}

// One grid tile: a page link (`href`) or an in-page action (`onPress`).
function Tile({ href, onPress, icon, color, soft, title, text, badge }: {
  href?: Href; onPress?: () => void; icon: IconName; color: string; soft: string; title: string; text: string; badge?: ReactNode;
}) {
  const t = useTheme();
  const body = (
    <Pressable
      accessibilityRole={href ? 'link' : 'button'}
      accessibilityLabel={`${title}. ${text}`}
      onPress={onPress}
      // Link needs one flat style on its child (expo-router Slot).
      style={StyleSheet.flatten([s.tile, { backgroundColor: t.card, borderColor: t.border }, css({ boxShadow: t.shadow })])}>
      <View style={s.tileHead}>
        <View style={[s.tileIcon, { backgroundColor: soft }]}>
          <Ionicons name={icon} size={22} color={color} />
        </View>
        {badge}
      </View>
      <Text style={[s.tileTitle, { color: t.text }]}>{title}</Text>
      <Text style={[s.tileText, { color: t.muted }]}>{text}</Text>
    </Pressable>
  );
  return <View style={{ flex: 1 }}>{href ? <Link href={href} asChild>{body}</Link> : body}</View>;
}

const s = StyleSheet.create({
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  logo: { width: 44, height: 44, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  brand: { fontFamily: FONT.display, fontSize: 26, fontWeight: '700', flex: 1, letterSpacing: -0.4 },
  greeting: { fontFamily: FONT.body, fontSize: 18 },
  title: { fontFamily: FONT.display, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.6 },
  big: { borderRadius: 24, padding: 20, gap: 6, overflow: 'hidden', minHeight: 180 },
  ringBox: { position: 'absolute', top: 18, right: 18, width: 60, height: 60 },
  ring: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 30, borderWidth: 2 },
  ringCore: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  bigTitle: { fontFamily: FONT.display, fontSize: 28, lineHeight: 32, fontWeight: '700', letterSpacing: -0.5, marginTop: 4, paddingRight: 70 },
  bigText: { fontFamily: FONT.body, fontSize: 17, lineHeight: 24, paddingRight: 40 },
  go: { marginTop: 10, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: RADIUS.sm, paddingHorizontal: 16, minHeight: 48 },
  goText: { fontFamily: FONT.display, fontSize: 18, fontWeight: '700' },
  grid: { gap: 12 },
  gridRow: { flexDirection: 'row', gap: 12 },
  tile: { flex: 1, borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, gap: 6, minHeight: 128 },
  tileHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 },
  tileIcon: { width: 44, height: 44, borderRadius: RADIUS.sm, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontFamily: FONT.display, fontSize: 18, fontWeight: '700' },
  tileText: { fontFamily: FONT.body, fontSize: 15, lineHeight: 20 },
  live: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontFamily: FONT.body, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: RADIUS.lg, padding: 14 },
  stripText: { fontFamily: FONT.body, fontSize: 16, lineHeight: 22, flex: 1 },
  stripN: { fontFamily: FONT.display, fontWeight: '700' },
  note: { fontFamily: FONT.body, fontSize: 16, lineHeight: 22 },
});
