import Ionicons from '@expo/vector-icons/Ionicons';
import { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ContactSettings } from '@/components/ContactSettings';
import { HangUp } from '@/components/HangUp';
import { FONT, useTheme } from '@/components/theme';
import { Avatar, Body, Button, Card, ErrorText, Eyebrow, Field, Orb, Pill, Screen, ThemeToggle, Title, type IconName } from '@/components/ui';
import { api } from '@/shared/api';
import { QUESTIONS, coachScore, isHangUp, topFlag, type Answer, type Answers } from '@/shared/coach';
import { getContact } from '@/shared/contact';
import type { CoachResponse } from '@/shared/types';

type Step = 'intro' | number | 'done';

const noSubscribe = () => () => {};
const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
};

export default function Coach() {
  const t = useTheme();
  const [step, setStep] = useState<Step>('intro');
  const [answers, setAnswers] = useState<Answers>({});
  const [serverScore, setServerScore] = useState<number>();
  const [settings, setSettings] = useState(false);
  const [said, setSaid] = useState('');
  const [check, setCheck] = useState<'idle' | 'checking' | 'none' | { error: string }>('idle');
  // The server renders "Hello"; the phone's own clock picks the greeting (no hydration mismatch).
  const greeting = useSyncExternalStore(noSubscribe, greet, () => 'Hello');

  const restart = () => { setStep('intro'); setAnswers({}); setServerScore(undefined); setSaid(''); setCheck('idle'); };

  if (settings) return <ContactSettings onDone={() => setSettings(false)} />;
  // Scored on-device after every tap: the warning shows the moment the cutoff is reached (PLAN §4 short-circuit).
  if (isHangUp(coachScore(answers, serverScore))) {
    return <HangUp answers={answers} flag={topFlag(answers)} onSettings={() => setSettings(true)} onRestart={restart} />;
  }

  if (typeof step === 'number') {
    const q = QUESTIONS[step];
    const answer = (v: Answer) => {
      setAnswers({ ...answers, [q.id]: v });
      setStep(step + 1 < QUESTIONS.length ? step + 1 : 'done');
    };
    return (
      <Screen>
        <View style={s.row}>
          <Pressable accessibilityRole="button" accessibilityLabel="Start over" onPress={restart} style={[s.iconBtn, { backgroundColor: t.card, borderColor: t.border }]}>
            <Ionicons name="close" size={28} color={t.text} />
          </Pressable>
          <Text style={[s.stepTitle, { color: t.text }]}>Question {step + 1} of {QUESTIONS.length}</Text>
          <View style={{ width: 52 }} />
        </View>
        <View style={s.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {QUESTIONS.map((x, i) => (
            <View key={x.id} style={[s.segment, { backgroundColor: i <= step ? t.teal : t.border }]} />
          ))}
        </View>
        <Card>
          <Text accessibilityRole="header" style={[s.question, { color: t.text }]}>{q.text}</Text>
        </Card>
        <AnswerButton icon="checkmark-circle" label="YES" color={t.orange} onPress={() => answer(1)} />
        <AnswerButton icon="close-circle" label="NO" color={t.teal} onPress={() => answer(0)} />
        <AnswerButton icon="help-circle" label="NOT SURE" color={t.blue} onPress={() => answer(0.5)} />
      </Screen>
    );
  }

  if (step === 'done') {
    const checkWords = async () => {
      setCheck('checking');
      try {
        const { score } = await api<CoachResponse>('/api/coach', { text: said.trim() });
        setServerScore(score); // can only raise: coachScore takes the max
        setCheck('none');
      } catch (e) {
        setCheck({ error: (e as Error).message });
      }
    };
    return (
      <Screen>
        <Pill label="No strong signs" icon="shield-checkmark" color={t.tealSoft} fg={t.teal} />
        <Title>No strong scam signs from your answers</Title>
        <Card>
          <Body color={t.text}>Stay careful. Never share an OTP, PIN or password. If you feel unsure, hang up and call back on the number printed on your card or bill.</Body>
        </Card>
        <Field label="What did they say? (optional)" value={said} onChangeText={(v) => { setSaid(v); setCheck('idle'); }} multiline maxLength={2000} placeholder="For example: your son is arrested, pay a fine now" />
        <Button label={check === 'checking' ? 'Checking…' : 'Check their words'} icon="search" onPress={checkWords} disabled={!said.trim() || check === 'checking'} />
        {check === 'none' && <Body>Still no strong scam signs. Trust your feeling: you can always hang up.</Body>}
        {typeof check === 'object' && <ErrorText>{check.error}</ErrorText>}
        <Button label="Start again" kind="ghost" icon="refresh" onPress={restart} />
      </Screen>
    );
  }

  const { to, firstName } = getContact();
  return (
    <Screen>
      <View style={s.head}>
        <View style={{ gap: 4, flex: 1 }}>
          <Text style={[s.greeting, { color: t.muted }]}>{firstName ? `${greeting}, ${firstName}` : greeting}</Text>
          <Title>On a call right now?</Title>
        </View>
        <ThemeToggle />
      </View>
      <Orb color={t.teal} chips={['OTP & PIN', 'Money', 'Fake Police', 'Family']}>
        <Ionicons name="shield-checkmark" size={72} color={t.onTeal} />
      </Orb>
      <Body>Answer a few yes or no questions. We will tell you if it looks like a scam. Works without internet.</Body>
      <Button label="Start the check" icon="arrow-forward" onPress={() => setStep(0)} />

      <Eyebrow>Family circle</Eyebrow>
      <Pressable accessibilityRole="button" onPress={() => setSettings(true)} style={[s.contact, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={s.avatars}>
          <Avatar label="You" color="#3B4A86" size={52} />
          <View style={{ marginLeft: -6 }}>
            <Avatar label={to ? '✓' : '?'} color={to ? t.tealDeep : t.purple} size={52} />
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[s.contactTitle, { color: t.text }]}>{to ? 'Family contact saved' : 'Add a family contact'}</Text>
          <Text style={[s.contactSub, { color: t.muted }]}>{to ? `+${to} · tap to change` : 'We help you warn them if a call is a scam'}</Text>
        </View>
        <Ionicons name="chevron-forward" size={24} color={t.muted} />
      </Pressable>
    </Screen>
  );
}

function AnswerButton({ icon, label, color, onPress }: { icon: IconName; label: string; color: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={({ pressed }) => [s.answer, { backgroundColor: t.card, borderColor: color, opacity: pressed ? 0.8 : 1 }]}>
      <Ionicons name={icon} size={38} color={color} />
      <Text style={[s.answerText, { color: t.text }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  iconBtn: { width: 52, height: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontFamily: FONT.display, fontSize: 20, fontWeight: '700', flex: 1, textAlign: 'center' },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 8, borderRadius: 4 },
  question: { fontFamily: FONT.display, fontSize: 28, lineHeight: 36, fontWeight: '700' },
  answer: { minHeight: 76, borderRadius: 22, borderWidth: 2.5, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 22 },
  answerText: { fontFamily: FONT.display, fontSize: 26, fontWeight: '700', letterSpacing: 1 },
  greeting: { fontFamily: FONT.body, fontSize: 18 },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 22, padding: 14, minHeight: 76 },
  avatars: { flexDirection: 'row' },
  contactTitle: { fontFamily: FONT.display, fontSize: 19, fontWeight: '700' },
  contactSub: { fontFamily: FONT.body, fontSize: 16, marginTop: 2 },
});
