import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { saveContact } from '@/shared/contact';
import { clearProfile, loadProfile, normalizePhone, saveProfile, type ProfileField } from '@/shared/profile';
import { FONT, useTheme } from './theme';
import { Body, Button, Card, ErrorText, Eyebrow, Field, Header, Menu, MenuRow, Screen } from './ui';
import { refreshProfile } from './useProfile';

// The helper types these on the elder's phone, one per page (TEAM-PLAN §4.1).
const STEPS = [
  { field: 'helperName', who: 'You, the helper', title: 'What is your name?', label: 'Your name', placeholder: 'Priya', hint: 'They will see “Ask Priya to check” on their screen.' },
  { field: 'trustedContact', who: 'You, the helper', title: 'What is your WhatsApp number?', label: 'Your WhatsApp number', placeholder: '5712 3456', hint: 'Their help requests and scam alerts come to this number. It stays on this phone.' },
  { field: 'firstName', who: 'The person you help', title: 'What is their first name?', label: 'Their first name', placeholder: 'Asha', hint: 'You will see their name on the messages they ask you to check.' },
] as const satisfies readonly { field: ProfileField; [k: string]: string }[];

// "+230 5712 3456" for a Mauritian mobile; other countries are shown as typed digits.
const pretty = (digits: string) => (/^230\d{8}$/.test(digits) ? `+230 ${digits.slice(3, 7)} ${digits.slice(7)}` : `+${digits}`);

// First-launch role choice, the helper's setup of the elder's phone, and "Change setup" (PLAN §7.3 step 1).
export function Setup({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  // Read when the page opens (TEAM-PLAN §4.1). The tabs only follow on the way out: Elder mode hides the Home tab,
  // and switching it on while this page is still open inside Home would close the page under the person's finger.
  const [profile, setProfile] = useState(loadProfile);
  const [step, setStep] = useState<'role' | 0 | 1 | 2 | 'confirm' | 'saved'>();
  const [form, setForm] = useState({ helperName: '', trustedContact: '', firstName: '' });
  const [error, setError] = useState('');
  const done = () => { onDone(); refreshProfile(); };

  function pickHelper() {
    const r = saveProfile({ role: 'helper' });
    if (!r.ok) return setError(r.error);
    setProfile(r.profile);
    refreshProfile();
    setStep(undefined);
  }

  function save() {
    const r = saveProfile({ role: 'elder', ...form });
    if (!r.ok) {
      setError(r.error);
      const at = STEPS.findIndex((x) => x.field === r.field);
      return at >= 0 ? setStep(at as 0 | 1 | 2) : undefined; // no field: the phone refused to save, say so here
    }
    if (r.profile.role === 'elder') saveContact(r.profile.trustedContact, r.profile.firstName); // the Coach's alert goes to the same helper
    setProfile(r.profile);
    setStep('saved');
  }

  if (step === 'saved' && profile?.role === 'elder') {
    return (
      <Screen key="saved">
        <View style={[s.done, { backgroundColor: t.tealSoft }]}>
          <Ionicons name="checkmark" size={32} color={t.teal} />
        </View>
        <Header eyebrow="Elder mode is on" title={`This phone is ready for ${profile.firstName}`} right={null} />
        <Body>They will see only Scan and Coach. To change this later, open “Phone setup” at the bottom of the Scan page.</Body>
        <Body>On your own phone, open this app and choose “I&apos;m helping someone”.</Body>
        <Button label="Done" icon="checkmark" onPress={done} />
      </Screen>
    );
  }

  if (typeof step === 'number') {
    const q = STEPS[step];
    const value = form[q.field];
    const next = () => {
      if (!value.trim()) return setError(q.field === 'trustedContact' ? 'Please type your WhatsApp number.' : 'Please type a name.');
      if (q.field === 'trustedContact' && !normalizePhone(value)) return setError('Enter a WhatsApp number, for example 5712 3456 or +44 7700 900123.');
      setStep(step < 2 ? ((step + 1) as 1 | 2) : 'confirm');
    };
    return (
      // Keyed by step so each question fades in as a new page.
      <Screen key={step}>
        <Header eyebrow={`Step ${step + 1} of ${STEPS.length} · ${q.who}`} title={q.title} onBack={() => { setError(''); setStep(step > 0 ? ((step - 1) as 0 | 1) : 'role'); }} />
        <View style={s.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {STEPS.map((x, i) => (
            <View key={x.field} style={[s.segment, { backgroundColor: i <= step ? t.teal : t.border }]} />
          ))}
        </View>
        <Field
          label={q.label}
          value={value}
          onChangeText={(v) => { setForm({ ...form, [q.field]: v }); setError(''); }}
          placeholder={q.placeholder}
          maxLength={q.field === 'trustedContact' ? 24 : 30}
          keyboardType={q.field === 'trustedContact' ? 'phone-pad' : 'default'}
          autoComplete={q.field === 'trustedContact' ? 'tel' : 'off'}
          autoCorrect={false}
          onSubmitEditing={next}
          error={error || undefined}
        />
        <Body>{q.hint}</Body>
        <Button label="Next" icon="arrow-forward" onPress={next} />
      </Screen>
    );
  }

  if (step === 'confirm') {
    return (
      <Screen key="confirm">
        <Header eyebrow="Check before saving" title="Is this right?" onBack={() => { setError(''); setStep(2); }} />
        <Card>
          <Eyebrow>{form.helperName.trim()}&apos;s WhatsApp number</Eyebrow>
          <Text style={[s.number, { color: t.text }]}>{pretty(normalizePhone(form.trustedContact) ?? '')}</Text>
          <Body>A wrong digit would send {form.firstName.trim()}&apos;s alerts to a stranger.</Body>
        </Card>
        {!!error && <ErrorText>{error}</ErrorText>}
        <Button label="Yes, turn on Elder mode" icon="checkmark" onPress={save} />
        <Button label="Change" kind="ghost" icon="create-outline" onPress={() => { setError(''); setStep(1); }} />
      </Screen>
    );
  }

  if (profile && step !== 'role') {
    const elder = profile.role === 'elder' ? profile : null;
    return (
      <Screen>
        <Header eyebrow="Phone setup" title={elder ? `Set up for ${elder.firstName}` : 'You are a helper'} onBack={done} />
        {elder ? (
          <Card>
            <Line label="Helper" value={elder.helperName} />
            <Line label="Helper's WhatsApp" value={pretty(elder.trustedContact)} line />
            <Line label="Elder mode" value="On: Scan and Coach only" line />
          </Card>
        ) : (
          <Body>When someone asks you to check a message, you get a 6-digit code on WhatsApp. Enter it under “Help someone” on the Home page.</Body>
        )}
        <Button label="Change setup" kind="ghost" icon="create-outline" onPress={() => setStep('role')} />
        {elder && <Button label="Turn off Elder mode" kind="ghost" icon="power" onPress={() => { clearProfile(); setProfile(null); refreshProfile(); }} />}
      </Screen>
    );
  }

  return (
    <Screen key="role">
      <Header eyebrow="Helping Hands" title="Who is this phone for?" onBack={profile ? () => setStep(undefined) : done} />
      <Body>One person helps, the other gets help. Choose once on each phone. There is no account and no password.</Body>
      {!!error && <ErrorText>{error}</ErrorText>}
      <Menu>
        <MenuRow icon="hand-left-outline" title="I'm helping someone" text="This is my own phone. I check messages for them." onPress={pickHelper} />
        <MenuRow icon="phone-portrait-outline" title="I'm setting this up for someone" text="This is their phone. I will be their helper." onPress={() => { setError(''); setStep(0); }} />
      </Menu>
    </Screen>
  );
}

function Line({ label, value, line }: { label: string; value: string; line?: boolean }) {
  const t = useTheme();
  return (
    <View style={[s.line, line && { borderTopWidth: 1, borderColor: t.border, paddingTop: 12 }]}>
      <Text style={[s.lineLabel, { color: t.muted }]}>{label}</Text>
      <Text style={[s.lineValue, { color: t.text }]}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  done: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  number: { fontFamily: FONT.display, fontSize: 32, lineHeight: 40, fontWeight: '700', letterSpacing: -0.5 },
  line: { gap: 2 },
  lineLabel: { fontFamily: FONT.body, fontSize: 15, lineHeight: 20, fontWeight: '600' },
  lineValue: { fontFamily: FONT.display, fontSize: 20, lineHeight: 28, fontWeight: '700' },
});
