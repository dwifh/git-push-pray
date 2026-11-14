import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useState, useSyncExternalStore } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ContactSettings } from '@/components/ContactSettings';
import { HangUp } from '@/components/HangUp';
import { FONT, RADIUS, css, useTheme } from '@/components/theme';
import { Avatar, Body, Button, Card, EASE, ErrorText, Eyebrow, Field, Header, IconButton, Orb, Pill, Screen, Title, isHover, useResetOnLeave, type IconName } from '@/components/ui';
import { api } from '@/shared/api';
import { HANG_UP_CUTOFF, QUESTIONS, coachScore, isHangUp, topFlag, type Answer, type Answers } from '@/shared/coach';
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
  // On the questions with none answered yet: leaving the tab goes back to the start page.
  useResetOnLeave(typeof step === 'number' && Object.keys(answers).length === 0, restart);

  // Scan's "I answered by mistake" sends ?start=<time>: go straight to question 1. Each tap is a new time.
  // Checked during render (React's "adjust state on prop change"), so no effect is needed.
  const { start } = useLocalSearchParams<{ start?: string }>();
  const [started, setStarted] = useState<string>();
  if (start && start !== started) {
    setStarted(start);
    restart();
    setSettings(false);
    setStep(0);
  }

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
      // Keyed by step so each question fades in as a new page.
      <Screen key={step}>
        <View style={s.row}>
          <IconButton icon="close" label="Start over" onPress={restart} />
          <Text style={[s.stepTitle, { color: t.muted }]}>Question {step + 1} of {QUESTIONS.length}</Text>
          <View style={{ width: 48 }} />
        </View>
        <View style={s.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {QUESTIONS.map((x, i) => (
            <View key={x.id} style={[s.segment, { backgroundColor: i <= step ? t.teal : t.border }, i === step && css({ backgroundImage: t.gradTeal, boxShadow: `0 0 12px ${t.glowTeal}`, transformOrigin: 'left', animation: 'grow 500ms ease-out both' })]} />
          ))}
        </View>
        <SignsMeter level={Math.min(1, coachScore(answers) / HANG_UP_CUTOFF)} />
        <Text accessibilityRole="header" style={[s.question, { color: t.text }]}>{q.text}</Text>
        <View style={{ gap: 12 }}>
          <AnswerButton icon="checkmark-circle" label="Yes" color={t.orange} onPress={() => answer(1)} />
          <AnswerButton icon="close-circle" label="No" color={t.teal} onPress={() => answer(0)} />
          <AnswerButton icon="help-circle" label="Not sure" color={t.blue} onPress={() => answer(0.5)} />
        </View>
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
        <View style={{ gap: 12 }}>
          <Pill label="No strong signs" icon="shield-checkmark" color={t.tealSoft} fg={t.teal} />
          <Title>No strong scam signs from your answers</Title>
        </View>
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
      <Header eyebrow={firstName ? `${greeting}, ${firstName}` : greeting} title="On a call right now?" />
      <Orb color={t.teal} grad={t.gradTeal} glow={t.glowTeal} chips={['OTP & PIN', 'Money', 'Fake police', 'Family']}>
        <Ionicons name="shield-checkmark" size={56} color={t.onTeal} />
      </Orb>
      <Body>Answer a few yes or no questions. We will tell you if it looks like a scam. Works without internet.</Body>
      <Button label="Start the check" icon="arrow-forward" onPress={() => setStep(0)} />

      <View style={{ gap: 12 }}>
        <Eyebrow>Family circle</Eyebrow>
        <Pressable
          accessibilityRole="button"
          onPress={() => setSettings(true)}
          style={(st) => [s.contact, EASE, { backgroundColor: st.pressed || isHover(st) ? t.cardHi : t.card, borderColor: t.border }, css({ boxShadow: t.shadow })]}>
          <View style={s.avatars}>
            <Avatar label="You" color="#3B4A86" size={48} icon="person" />
            <View style={{ marginLeft: -10 }}>
              <Avatar label="" color={to ? t.tealDeep : t.purple} size={48} icon={to ? 'checkmark' : 'add'} />
            </View>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={[s.contactTitle, { color: t.text }]}>{to ? 'Family contact saved' : 'Add a family contact'}</Text>
            <Text style={[s.contactSub, { color: t.muted }]}>{to ? `+${to} · tap to change` : 'We help you warn them if a call is a scam'}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={t.muted} />
        </Pressable>
      </View>
    </Screen>
  );
}

// How close the answers so far are to the HANG UP cutoff (0 to 1), from the same on-device score.
// Told by a word as well as the bar; the gradient spans the whole track, so the fill's end colour shows how far it got.
function SignsMeter({ level }: { level: number }) {
  const t = useTheme();
  const word = level === 0 ? 'None yet' : level < 0.5 ? 'A few' : 'Rising';
  return (
    <View accessible accessibilityLabel={`Scam signs so far: ${word}`} style={[s.meter, { backgroundColor: t.card, borderColor: t.border }, css({ boxShadow: t.shadow })]}>
      <View style={s.meterHead}>
        <Eyebrow>Scam signs so far</Eyebrow>
        <View style={s.meterWord}>
          {level > 0 && <View style={[s.dot, { backgroundColor: t.orange }, css({ animation: 'blink 1.4s ease-in-out infinite' })]} />}
          <Text style={[s.meterWordText, { color: level >= 0.5 ? t.orange : level > 0 ? t.text : t.teal }]}>{word}</Text>
        </View>
      </View>
      <View style={[s.track, { backgroundColor: t.border }]}>
        {level > 0 && (
          <View style={[s.fill, { width: `${level * 100}%` }, css({
            backgroundImage: `linear-gradient(90deg, ${t.teal}, #E8B04A, ${t.orange})`,
            backgroundSize: `${100 / level}% 100%`,
            boxShadow: level >= 0.5 ? `0 0 14px ${t.glowOrange}` : 'none',
            transformOrigin: 'left',
            animation: 'grow 900ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
          })]} />
        )}
      </View>
      <View style={s.meterHead}>
        <Text style={[s.meterEnd, { color: t.muted }]}>Calm</Text>
        <Text style={[s.meterEnd, { color: t.muted }]}>Hang up</Text>
      </View>
    </View>
  );
}

function AnswerButton({ icon, label, color, onPress }: { icon: IconName; label: string; color: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(st) => [s.answer, EASE, { backgroundColor: st.pressed || isHover(st) ? t.cardHi : t.card, borderColor: st.pressed ? color : t.borderStrong, transform: [{ scale: st.pressed ? 0.98 : 1 }] }]}>
      <Ionicons name={icon} size={32} color={color} />
      <Text style={[s.answerText, { color: t.text }]}>{label}</Text>
    </Pressable>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  stepTitle: { fontFamily: FONT.body, fontSize: 17, fontWeight: '600', flex: 1, textAlign: 'center' },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 6, borderRadius: 3 },
  meter: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 14, gap: 8 },
  meterHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  meterWord: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meterWordText: { fontFamily: FONT.body, fontSize: 15, fontWeight: '700' },
  meterEnd: { fontFamily: FONT.body, fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  track: { height: 12, borderRadius: 6, overflow: 'hidden' },
  fill: { height: 12, borderRadius: 6 },
  question: { fontFamily: FONT.display, fontSize: 28, lineHeight: 36, fontWeight: '700', letterSpacing: -0.4, paddingVertical: 12 },
  answer: { minHeight: 72, borderRadius: RADIUS.md, borderWidth: 1.5, flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 20 },
  answerText: { fontFamily: FONT.display, fontSize: 24, fontWeight: '700' },
  contact: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: RADIUS.lg, padding: 16, minHeight: 80 },
  avatars: { flexDirection: 'row' },
  contactTitle: { fontFamily: FONT.display, fontSize: 19, fontWeight: '700' },
  contactSub: { fontFamily: FONT.body, fontSize: 16, lineHeight: 22 },
});
