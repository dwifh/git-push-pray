import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ContactSettings } from '@/components/ContactSettings';
import { HangUp } from '@/components/HangUp';
import { useTheme } from '@/components/theme';
import { Body, Button, Card, ErrorText, Eyebrow, Field, Screen, Title, type IconName } from '@/components/ui';
import { api } from '@/shared/api';
import { QUESTIONS, coachScore, isHangUp, topFlag, type Answer, type Answers } from '@/shared/coach';
import { getContact } from '@/shared/contact';
import type { CoachResponse } from '@/shared/types';

type Step = 'intro' | number | 'done';

export default function Coach() {
  const t = useTheme();
  const [step, setStep] = useState<Step>('intro');
  const [answers, setAnswers] = useState<Answers>({});
  const [serverScore, setServerScore] = useState<number>();
  const [settings, setSettings] = useState(false);
  const [said, setSaid] = useState('');
  const [check, setCheck] = useState<'idle' | 'checking' | 'none' | { error: string }>('idle');

  const restart = () => { setStep('intro'); setAnswers({}); setServerScore(undefined); setSaid(''); setCheck('idle'); };

  if (settings) return <ContactSettings onDone={() => setSettings(false)} />;
  // Scored on-device after every tap: the warning shows the moment the cutoff is reached (PLAN §4 short-circuit).
  if (isHangUp(coachScore(answers, serverScore))) {
    return <HangUp flag={topFlag(answers)} onSettings={() => setSettings(true)} onRestart={restart} />;
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
          <Eyebrow>Question {step + 1} of {QUESTIONS.length}</Eyebrow>
          <Pressable accessibilityRole="button" onPress={restart} style={s.link}>
            <Text style={[s.linkText, { color: t.muted }]}>Start over</Text>
          </Pressable>
        </View>
        <View style={[s.track, { backgroundColor: t.border }]}>
          <View style={[s.fill, { backgroundColor: t.teal, width: `${((step + 1) / QUESTIONS.length) * 100}%` }]} />
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
        <Eyebrow color={t.teal}>Your answers</Eyebrow>
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
      <View style={{ gap: 6 }}>
        <Eyebrow>Call Coach</Eyebrow>
        <Title>{firstName ? `${firstName}, on a call right now?` : 'On a call right now?'}</Title>
      </View>
      <View style={s.orbWrap}>
        <View style={[s.orbOuter, { borderColor: t.border }]}>
          <View style={[s.orbRing, { borderColor: t.teal }]}>
            <View style={[s.orb, { backgroundColor: t.teal, shadowColor: t.teal }]}>
              <Ionicons name="shield-checkmark" size={76} color={t.onTeal} />
            </View>
          </View>
        </View>
      </View>
      <Body>Answer a few yes or no questions. We will tell you if it looks like a scam. Works without internet.</Body>
      <Button label="Start" icon="arrow-forward" onPress={() => setStep(0)} />
      <Pressable accessibilityRole="button" onPress={() => setSettings(true)} style={[s.contact, { backgroundColor: t.card, borderColor: t.border }]}>
        <View style={[s.contactIcon, { backgroundColor: t.tealSoft }]}>
          <Ionicons name="people" size={26} color={t.teal} />
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
      <Ionicons name={icon} size={36} color={color} />
      <Text style={[s.answerText, { color: t.text }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' },
  link: { minHeight: 48, justifyContent: 'center', paddingHorizontal: 8 },
  linkText: { fontSize: 17, fontWeight: '700', textDecorationLine: 'underline' },
  track: { height: 10, borderRadius: 5, overflow: 'hidden' },
  fill: { height: 10, borderRadius: 5 },
  question: { fontSize: 28, lineHeight: 36, fontWeight: '800' },
  answer: { minHeight: 76, borderRadius: 22, borderWidth: 2.5, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 22 },
  answerText: { fontSize: 26, fontWeight: '900', letterSpacing: 1 },
  orbWrap: { alignItems: 'center', paddingVertical: 4 },
  orbOuter: { padding: 18, borderRadius: 999, borderWidth: 1 },
  orbRing: { padding: 16, borderRadius: 999, borderWidth: 1.5, borderStyle: 'dashed' },
  orb: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center', shadowOpacity: 0.45, shadowRadius: 28, shadowOffset: { width: 0, height: 0 } },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 20, padding: 14, minHeight: 72 },
  contactIcon: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  contactTitle: { fontSize: 19, fontWeight: '800' },
  contactSub: { fontSize: 16, marginTop: 2 },
});
