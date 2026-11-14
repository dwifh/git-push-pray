import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendAlert } from '@/shared/alert';
import { QUESTIONS, type Answers } from '@/shared/coach';
import { getContact } from '@/shared/contact';
import { ALARM, FONT, RADIUS, css } from './theme';
import { EASE, isHover, type IconName } from './ui';

// Fixed flag text is written about the user ("them"); on their own screen it speaks to them.
const toYou = (flag: string) => (flag[0].toUpperCase() + flag.slice(1)).replace(/\bthem\b/, 'you');

// Rendered from on-device scoring alone (PLAN §4). Every action below is optional; none gates the warning.
export function HangUp({ answers, flag, onSettings, onRestart }: { answers: Answers; flag: string; onSettings: () => void; onRestart: () => void }) {
  const { top } = useSafeAreaInsets();
  const { to, firstName } = getContact();
  const [alert, setAlert] = useState<'idle' | 'sending' | { sent: boolean; waMe: string }>('idle');
  const signs = QUESTIONS.filter((q) => answers[q.id] === 1).map((q) => toYou(q.flag));

  async function alertContact() {
    setAlert('sending');
    // call_alert: {{1}} = the user's first name, {{2}} = the fixed warning sign. Never throws.
    setAlert(await sendAlert({ template: 'call_alert', to, vars: [firstName || 'Your family member', flag] }));
  }

  return (
    <ScrollView style={s.page} contentContainerStyle={[s.inner, { paddingTop: top + 28 }]}>
      <View accessibilityLiveRegion="assertive" style={{ gap: 16 }}>
        <View style={s.badge}>
          <Ionicons name="warning" size={18} color={ALARM.ink} />
          <Text style={s.badgeText}>THIS IS A SCAM</Text>
        </View>
        <View style={s.rings}>
          <View style={[s.ring, { borderColor: ALARM.soft }]}>
            <View style={[s.ring, { borderColor: ALARM.line }]}>
              <View style={s.core}>
                <Ionicons name="call" size={52} color={ALARM.bg} style={{ transform: [{ rotate: '135deg' }] }} />
              </View>
            </View>
          </View>
        </View>
        <Text accessibilityRole="header" style={s.hang}>HANG UP NOW</Text>
        <Text style={s.advice}>Put the phone down. Do not share any code. Do not send money.</Text>

        <View style={s.card}>
          {(signs.length ? signs : [toYou(flag)]).map((sign) => (
            <View key={sign} style={s.sign}>
              <Ionicons name="alert-circle" size={24} color={ALARM.badge} />
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
      style={(st) => [s.action, EASE, half && s.half, { backgroundColor: solid ? ALARM.text : st.pressed || isHover(st) ? ALARM.soft : 'transparent', opacity: disabled ? 0.6 : solid && (st.pressed || isHover(st)) ? 0.9 : 1, transform: [{ scale: st.pressed ? 0.98 : 1 }] }]}>
      <Ionicons name={icon} size={24} color={fg} />
      <Text style={[s.actionText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  // One flat alarm red. --focus: the keyboard focus ring is white here (teal would vanish on red).
  page: { flex: 1, backgroundColor: ALARM.bg, ...css({ '--focus': ALARM.text }) },
  inner: { paddingHorizontal: 20, paddingBottom: 40, width: '100%', maxWidth: 600, alignSelf: 'center' },
  badge: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: ALARM.badge, borderRadius: RADIUS.pill, paddingHorizontal: 16, paddingVertical: 8 },
  badgeText: { fontFamily: FONT.body, color: ALARM.ink, fontSize: 15, fontWeight: '800', letterSpacing: 1.4 },
  rings: { alignItems: 'center' },
  ring: { borderRadius: RADIUS.pill, borderWidth: 1, padding: 12 },
  core: { width: 112, height: 112, borderRadius: 56, backgroundColor: ALARM.text, alignItems: 'center', justifyContent: 'center' },
  hang: { fontFamily: FONT.display, color: ALARM.text, fontSize: 46, lineHeight: 50, fontWeight: '700', textAlign: 'center', letterSpacing: -1 },
  advice: { fontFamily: FONT.body, color: ALARM.text, fontSize: 19, lineHeight: 28, textAlign: 'center' },
  card: { gap: 8 },
  sign: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: ALARM.soft, borderRadius: RADIUS.md, padding: 16 },
  signText: { fontFamily: FONT.body, color: ALARM.text, fontSize: 18, lineHeight: 26, fontWeight: '600', flex: 1 },
  pair: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  half: { flexGrow: 1, flexBasis: 150 },
  action: { minHeight: 60, borderRadius: RADIUS.md, borderWidth: 1.5, borderColor: ALARM.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, paddingHorizontal: 16, paddingVertical: 10 },
  actionText: { fontFamily: FONT.display, fontSize: 20, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  restart: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  restartText: { fontFamily: FONT.body, color: ALARM.text, fontSize: 17, fontWeight: '600', textDecorationLine: 'underline' },
});
