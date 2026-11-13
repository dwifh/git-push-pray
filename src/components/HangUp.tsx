import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { sendAlert } from '@/shared/alert';
import { getContact } from '@/shared/contact';
import { ALARM } from './theme';
import type { IconName } from './ui';

// Rendered from on-device scoring alone (PLAN §4). Every action below is optional; none gates the warning.
export function HangUp({ flag, onSettings, onRestart }: { flag: string; onSettings: () => void; onRestart: () => void }) {
  const { top } = useSafeAreaInsets();
  const { to, firstName } = getContact();
  const [alert, setAlert] = useState<'idle' | 'sending' | { sent: boolean; waMe: string }>('idle');

  async function alertContact() {
    setAlert('sending');
    // call_alert: {{1}} = the user's first name, {{2}} = the fixed warning sign. Never throws.
    setAlert(await sendAlert({ template: 'call_alert', to, vars: [firstName || 'Your family member', flag] }));
  }

  return (
    <ScrollView style={s.page} contentContainerStyle={[s.inner, { paddingTop: top + 28 }]}>
      <View accessibilityLiveRegion="assertive" style={{ gap: 14 }}>
        <View style={s.rings}>
          <View style={s.ring2}>
            <View style={s.ring1}>
              <Ionicons name="call" size={64} color={ALARM.bg} style={{ transform: [{ rotate: '135deg' }] }} />
            </View>
          </View>
        </View>
        <Text accessibilityRole="header" style={s.hang}>HANG UP NOW</Text>
        <Text style={s.scam}>THIS IS A SCAM</Text>
        <View style={s.note}>
          <Ionicons name="warning" size={26} color={ALARM.text} />
          <Text style={s.noteText}>Warning sign: {flag}.</Text>
        </View>
        <Text style={s.advice}>Put the phone down. Do not share any code. Do not send money.</Text>

        {!to ? (
          <Action icon="person-add" label="Add a family contact" onPress={onSettings} solid />
        ) : alert === 'idle' || alert === 'sending' ? (
          <Action icon="logo-whatsapp" label={alert === 'sending' ? 'Sending alert…' : 'Alert my family on WhatsApp'} onPress={alertContact} solid disabled={alert === 'sending'} />
        ) : (
          <>
            <View style={s.note}>
              <Ionicons name={alert.sent ? 'checkmark-circle' : 'alert-circle'} size={26} color={ALARM.text} />
              <Text style={s.noteText}>{alert.sent ? 'Alert sent to your family contact.' : 'Could not send it automatically. Send it yourself:'}</Text>
            </View>
            {/* Shown even when sent: Meta can accept a send and still drop it (PLAN §0). */}
            <Action icon="logo-whatsapp" label={alert.sent ? 'Also send it on WhatsApp' : 'Open WhatsApp to send'} onPress={() => Linking.openURL(alert.waMe)} solid={!alert.sent} />
          </>
        )}
        {!!to && <Action icon="call" label="Call my family contact" onPress={() => Linking.openURL(`tel:+${to}`)} />}
        <Action icon="shield" label="Call Police: 999" onPress={() => Linking.openURL('tel:999')} />
        <View style={s.note}>
          <Ionicons name="card" size={26} color={ALARM.text} />
          <Text style={s.noteText}>Worried about your bank? Call the number printed on your bank card.</Text>
        </View>
        <Pressable accessibilityRole="button" onPress={onRestart} style={s.restart}>
          <Text style={s.restartText}>Start over</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Action({ icon, label, onPress, solid, disabled }: { icon: IconName; label: string; onPress: () => void; solid?: boolean; disabled?: boolean }) {
  const fg = solid ? ALARM.bg : ALARM.text;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.action, solid && { backgroundColor: ALARM.text }, { opacity: pressed || disabled ? 0.8 : 1 }]}>
      <Ionicons name={icon} size={26} color={fg} />
      <Text style={[s.actionText, { color: fg }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  page: { flex: 1, backgroundColor: ALARM.bg },
  inner: { paddingHorizontal: 16, paddingBottom: 40, width: '100%', maxWidth: 560, alignSelf: 'center' },
  rings: { alignItems: 'center', marginBottom: 6 },
  ring2: { padding: 14, borderRadius: 999, borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)' },
  ring1: { width: 128, height: 128, borderRadius: 64, backgroundColor: ALARM.text, alignItems: 'center', justifyContent: 'center' },
  hang: { color: ALARM.text, fontSize: 44, lineHeight: 50, fontWeight: '900', textAlign: 'center', letterSpacing: -0.5 },
  scam: { color: ALARM.text, fontSize: 26, fontWeight: '800', textAlign: 'center', letterSpacing: 1.5 },
  note: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: ALARM.soft, borderRadius: 20, padding: 16 },
  noteText: { color: ALARM.text, fontSize: 19, lineHeight: 26, fontWeight: '600', flex: 1 },
  advice: { color: ALARM.text, fontSize: 19, lineHeight: 26, textAlign: 'center' },
  action: { minHeight: 64, borderRadius: 20, borderWidth: 2, borderColor: ALARM.text, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  actionText: { fontSize: 21, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  restart: { minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  restartText: { color: ALARM.text, fontSize: 18, fontWeight: '700', textDecorationLine: 'underline' },
});
