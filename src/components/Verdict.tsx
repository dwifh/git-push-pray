import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import type { Verdict } from '@/shared/types';
import { FONT, RADIUS, css, useTheme } from './theme';
import { Body, Button, Card, DECOR, Eyebrow, type IconName } from './ui';

// One wording per verdict, shared by Scan, Email Guard and the Helper page. SAFE never says "safe" (CLAUDE.md).
const LOOK: Record<Verdict, { icon: IconName; word: string; title: string; text: string }> = {
  HIGH_RISK: { icon: 'warning', word: 'High risk', title: 'This looks like a scam', text: 'Do not tap any link, reply, pay or share a code.' },
  SUSPICIOUS: { icon: 'alert-circle', word: 'Suspicious', title: 'This could be a scam', text: 'Do not tap links, pay or share codes until you have checked.' },
  SAFE: { icon: 'shield-outline', word: 'Nothing found', title: 'No known scam signs found', text: 'That is not a guarantee. Never share an OTP, PIN or password.' },
};

// The verdict is told three ways, never by colour alone: an icon, a word, and how heavy the block is.
// HIGH_RISK is the page's one filled block, SUSPICIOUS is tinted and outlined, SAFE is a plain card in neutral blue.
export function VerdictHero({ verdict, text }: { verdict: Verdict; text?: string }) {
  const t = useTheme();
  const v = LOOK[verdict];
  const c = {
    HIGH_RISK: { bg: t.orange, border: t.orange, ink: t.onOrange, accent: t.onOrange, tile: `${t.onOrange}22`, grad: t.gradOrange, shadow: `0 24px 48px -20px ${t.glowOrange}` },
    SUSPICIOUS: { bg: t.orangeSoft, border: t.orange, ink: t.text, accent: t.orange, tile: t.card, grad: 'none', shadow: `0 18px 40px -24px ${t.glowOrange}` },
    SAFE: { bg: t.card, border: t.border, ink: t.text, accent: t.blue, tile: t.blueSoft, grad: 'none', shadow: t.shadow },
  }[verdict];


  return (
    <View accessibilityLiveRegion="polite" style={[s.hero, { backgroundColor: c.bg, borderColor: c.border }, css({ backgroundImage: c.grad, boxShadow: c.shadow })]}>
      {/* Big faint icon in the corner: decoration only. */}
      <View {...DECOR} style={[s.mark, css({ animation: 'pop 700ms cubic-bezier(0.2, 0.8, 0.2, 1) 200ms both' })]}>
        <Ionicons name={v.icon} size={150} color={c.accent} style={{ opacity: 0.1 }} />
      </View>
      <View style={s.heroTop}>
        <View style={[s.tile, { backgroundColor: c.tile }, css({ animation: 'pop 600ms cubic-bezier(0.2, 0.8, 0.2, 1) both' })]}>
          {verdict !== 'SAFE' && <View {...DECOR} style={[s.tileRing, { borderColor: c.accent }, css({ animation: 'ripple 2.4s ease-out infinite' })]} />}
          <Ionicons name={v.icon} size={28} color={c.accent} />
        </View>
        <Text style={[s.word, { color: c.accent }]}>{v.word}</Text>
      </View>
      <Text accessibilityRole="header" style={[s.heroTitle, { color: c.ink }]}>{v.title}</Text>
      <Text style={[s.heroText, { color: c.ink }]}>{text ?? v.text}</Text>
    </View>
  );
}

// Flags and advice are model text: plain <Text> only, never links or markdown (TEAM-PLAN §4).
// `onFix`: where "add the missing part" goes when the server asked a clarify question.
export function Findings({ verdict, flags, advice, clarify, onFix }: { verdict: Verdict; flags: string[]; advice: string; clarify?: string; onFix?: () => void }) {
  const t = useTheme();
  return (
    <>
      {!!clarify && (
        <Card accent={t.blue}>
          <View style={s.cardHead}>
            <Ionicons name="help-circle" size={26} color={t.blue} />
            <Text style={[s.cardTitle, { color: t.text }]}>One more thing</Text>
          </View>
          <Body color={t.text}>{clarify}</Body>
          {onFix && <Button label="Add it and check again" kind="ghost" icon="create-outline" onPress={onFix} />}
        </Card>
      )}
      {flags.length > 0 && (
        <View style={{ gap: 12 }}>
          <Eyebrow>What we found</Eyebrow>
          <Card>
            {flags.map((f, i) => (
              <View key={i} style={[s.flag, i > 0 && { borderTopWidth: 1, borderColor: t.border, paddingTop: 12 }, css({ animation: `rise 500ms ease-out ${300 + i * 90}ms both` })]}>
                <Text style={[s.flagN, { color: verdict === 'SAFE' ? t.muted : t.orange, backgroundColor: verdict === 'SAFE' ? t.cardHi : t.orangeSoft }]}>{i + 1}</Text>
                <Text style={[s.flagText, { color: t.text }]}>{f}</Text>
              </View>
            ))}
          </Card>
        </View>
      )}
      {!!advice && (
        <View style={{ gap: 12 }}>
          <Eyebrow>What to do</Eyebrow>
          <Card>
            <Body color={t.text}>{advice}</Body>
          </Card>
        </View>
      )}
    </>
  );
}

const s = StyleSheet.create({
  hero: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 20, gap: 10, overflow: 'hidden' },
  mark: { position: 'absolute', right: -28, bottom: -32 },
  tileRing: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: RADIUS.md, borderWidth: 2 },
  heroTop: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 4 },
  tile: { width: 52, height: 52, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  word: { fontFamily: FONT.body, fontSize: 15, lineHeight: 20, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase', flex: 1 },
  heroTitle: { fontFamily: FONT.display, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.6 },
  heroText: { fontFamily: FONT.body, fontSize: 18, lineHeight: 27 },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  cardTitle: { fontFamily: FONT.display, fontSize: 21, fontWeight: '700', flex: 1 },
  flag: { flexDirection: 'row', gap: 14, alignItems: 'flex-start' },
  flagN: { fontFamily: FONT.display, fontSize: 16, lineHeight: 28, width: 28, height: 28, borderRadius: 14, textAlign: 'center', fontWeight: '700', overflow: 'hidden' },
  flagText: { fontFamily: FONT.body, fontSize: 18, lineHeight: 27, flex: 1 },
});
