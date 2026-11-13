import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendAlert } from '@/shared/alert';
import { QUESTIONS, type Answers } from '@/shared/coach';
import { getContact } from '@/shared/contact';
import { ALARM, FONT, css, glow } from './theme';
import type { IconName } from './ui';

// Fixed flag text is written about the user ("them"); on their own screen it speaks to them.
const toYou = (flag: string) => (flag[0].toUpperCase() + flag.slice(1)).replace(/\bthem\b/, 'you');

// Rendered from on-device scoring alone (PLAN §4). Every action below is optional; none gates the warning.
export function HangUp({ answers, flag, onSettings, onReport, onRestart }: {
  answers: Answers; flag: string; onSettings: () => void; onReport: () => void; onRestart: () => void;
}) {
  const { top } = useSafeAreaInsets();
  // Buzz so the warning is noticed with the phone at the ear. Android browsers only; iPhones ignore it.
  useEffect(() => {
    try {
      globalThis.navigator?.vibrate?.([400, 200, 400]);
    } catch {}
  }, []);
  const { to, firstName } = getContact();
  const [alert, setAlert] = useState<'idle' | 'sending' | { sent: boolean; waMe: string }>('idle');
  const signs = QUESTIONS.filter((q) => answers[q.id] === 1).map((q) => toYou(q.flag));

  async function alertContact() {
    setAlert('sending');
    // call_alert: {{1}} = the user's first name, {{2}} = the fixed warning sign. Never throws.
    setAlert(await sendAlert({ template: 'call_alert', to, vars: [firstName || 'Your family member', flag] }));
  }

  const page = css({ backgroundImage: `radial-gradient(ellipse 100% 45% at 50% 0%, ${ALARM.glow}88, transparent 75%)` });
  return (
    <ScrollView style={[s.page, page]} contentContainerStyle={[s.inner, { paddingTop: top + 28 }]}>
      <View accessibilityLiveRegion="assertive" style={{ gap: 16 }}>
        <View style={s.badge}>
          <Ionicons name="warning" size={20} color="#2A0603" />
          <Text style={s.badgeText}>THIS IS A SCAM</Text>
        </View>
        <View style={s.rings}>
          <View style={[s.ring, { padding: 12, borderColor: 'rgba(255,255,255,0.14)' }]}>
            <View style={[s.ring, { padding: 12, borderColor: ALARM.line }]}>
              <View style={[s.core, glow(ALARM.glow, 40)]}>
                <Ionicons name="call" size={60} color={ALARM.bg} style={{ transform: [{ rotate: '135deg' }] }} />
              </View>
            </View>
          </View>
        </View>
        <Text accessibilityRole="header" style={s.hang}>HANG UP NOW</Text>
        <Text style={s.advice}>Put the phone down. Do not share any code. Do not send money.</Text>

        <View style={s.card}>
          {(signs.length ? signs : [toYou(flag)]).map((sign) => (
            <View key={sign} style={s.sign}>
              <Text style={s.bang}>!</Text>
              <Text style={s.signText}>{sign}</Text>
            </View>
          ))}
        </View>

        {!to ? (
          <Action icon="person-add" label="Add a family contact" onPress={onSettings} solid />
        ) : alert === 'idle' || alert === 'sending' ? (
          <Action icon="logo-whatsapp" label={alert === 'sending' ? 'Sending alert…' : 'Alert my family on WhatsApp'} onPress={alertContact} solid disabled={alert === 'sending'} />
        ) : (
          <>
            <View style={s.sign}>
              <Ionicons name={alert.sent ? 'checkmark-circle' : 'alert-circle'} size={26} color={ALARM.text} />
              <Text style={s.signText}>{alert.sent ? 'Alert sent to your family contact.' : 'Could not send it automatically. Send it yourself:'}</Text>
            </View>
            {/* Shown even when sent: Meta can accept a send and still drop it (PLAN §0). */}
            <Action icon="logo-whatsapp" label={alert.sent ? 'Also send it on WhatsApp' : 'Open WhatsApp to send'} onPress={() => Linking.openURL(alert.waMe)} solid={!alert.sent} />
          </>
        )}
        <View style={s.pair}>
          {!!to && <Action icon="call" label="Call family" onPress={() => Linking.openURL(`tel:+${to}`)} half />}
          <Action icon="shield" label="Police: 999" onPress={() => Linking.openURL('tel:999')} half />
        </View>
        <View style={s.sign}>
          <Ionicons name="card" size={26} color={ALARM.text} />
          <Text style={s.signText}>Worried about your bank? Call the number printed on your bank card.</Text>
        </View>
        <Action icon="megaphone" label="Report this call" onPress={onReport} />
        <Pressable accessibilityRole="button" onPress={onRestart} style={s.restart}>
          <Text style={s.restartText}>Start over</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// `half`: shares a row with another button, wrapping to full width on narrow phones.
function Action({ icon, label, onPress, solid, disabled, half }: { icon: IconName; label: string; onPress: () => void; solid?: boolean; disabled?: boolean; half?: boolean }) {
  const fg = solid ? ALARM.bg : ALARM.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.action, half && s.half, solid && [{ backgroundColor: ALARM.text }, glow('#FFFFFF', 20)], { opacity: pressed || disabled ? 0.8 : 1 }]}>
      <Ionicons name={icon} size={26} color={fg} />
      <Text style={[s.actionText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: ALARM.bg },
  inner: { paddingHorizontal: 16, paddingBottom: 40, width: '100%', maxWidth: 560, alignSelf: 'center' },
  badge: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ALARM.glow, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 9 },
  badgeText: { fontFamily: FONT.body, color: '#2A0603', fontSize: 17, fontWeight: '900', letterSpacing: 1.6 },
  rings: { alignItems: 'center' },
  ring: { borderRadius: 999, borderWidth: 1.5 },
  core: { width: 124, height: 124, borderRadius: 62, backgroundColor: ALARM.text, alignItems: 'center', justifyContent: 'center' },
  hang: { fontFamily: FONT.display, color: ALARM.text, fontSize: 46, lineHeight: 52, fontWeight: '700', textAlign: 'center', letterSpacing: -0.5 },
  advice: { fontFamily: FONT.body, color: ALARM.text, fontSize: 19, lineHeight: 27, textAlign: 'center' },
  card: { borderWidth: 1, borderColor: ALARM.line, backgroundColor: 'rgba(0,0,0,0.18)', borderRadius: 24, padding: 16, gap: 12 },
  sign: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: ALARM.soft, borderRadius: 18, padding: 14 },
  bang: { fontFamily: FONT.display, color: ALARM.glow, fontSize: 24, fontWeight: '700', width: 18, textAlign: 'center' },
  signText: { fontFamily: FONT.body, color: ALARM.text, fontSize: 19, lineHeight: 26, fontWeight: '600', flex: 1 },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  half: { flexGrow: 1, flexBasis: 150 },
  action: { minHeight: 64, borderRadius: 22, borderWidth: 2, borderColor: ALARM.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  actionText: { fontFamily: FONT.display, fontSize: 21, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  restart: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  restartText: { fontFamily: FONT.body, color: ALARM.text, fontSize: 18, fontWeight: '700', textDecorationLine: 'underline' },
});
