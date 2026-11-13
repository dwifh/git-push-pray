import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { api } from '@/shared/api';
import { DISTRICT_LABEL, VECTOR_LABEL, institutionLabel } from '@/shared/feed';
import { DISTRICTS, INSTITUTIONS, LIMITS, VECTORS, type Report, type ReportResponse } from '@/shared/types';
import { FONT, useTheme } from './theme';
import { Body, Button, Chip, ErrorText, Field, Pill, Screen, Title } from './ui';

// One decision per screen (CLAUDE.md UX rules). Tapping an answer moves on.
const PICKS = [
  { key: 'institution', title: 'Who did they pretend to be?', keys: INSTITUTIONS, name: institutionLabel },
  { key: 'vector', title: 'How did it reach you?', keys: VECTORS, name: (k: string) => VECTOR_LABEL[k as keyof typeof VECTOR_LABEL] },
  { key: 'district', title: 'Where do you live?', keys: DISTRICTS, name: (k: string) => DISTRICT_LABEL[k as keyof typeof DISTRICT_LABEL] },
] as const;
type Picks = Partial<Pick<Report, 'institution' | 'vector' | 'district'>>;

/** `initial`: answers already known (e.g. vector CALL from the Coach); those screens are skipped. */
export function ReportForm({ onDone, initial = {} }: { onDone: (sent: boolean) => void; initial?: Picks }) {
  const t = useTheme();
  const steps = PICKS.filter((p) => !initial[p.key]);
  const [picks, setPicks] = useState<Picks>(initial);
  const [step, setStep] = useState(0); // 0..steps.length-1 = a pick; steps.length = details
  const [domain, setDomain] = useState('');
  const [snippet, setSnippet] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | { error: string }>('idle');
  const total = steps.length + 1;

  async function submit() {
    if (!picks.institution || !picks.vector || !picks.district) return;
    setState('sending');
    try {
      const body: Report = { ...(picks as Required<Picks>), domain: domain.trim() || undefined, snippet: snippet.trim() || undefined };
      await api<ReportResponse>('/api/reports', body);
      setState('sent');
    } catch (e) {
      setState({ error: (e as Error).message });
    }
  }

  if (state === 'sent') {
    return (
      <Screen>
        <Pill label="Report sent" icon="checkmark-circle" color={t.tealSoft} fg={t.teal} />
        <Title>Thank you</Title>
        <Body>Your report helps warn other people in Mauritius. It is anonymous.</Body>
        <Button label="Done" icon="arrow-back" onPress={() => onDone(true)} />
      </Screen>
    );
  }

  const header = (
    <View style={{ gap: 14 }}>
      <View style={s.row}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={step === 0 ? 'Cancel' : 'Back'}
          onPress={() => (step === 0 ? onDone(false) : setStep(step - 1))}
          style={[s.iconBtn, { backgroundColor: t.card, borderColor: t.border }]}>
          <Ionicons name={step === 0 ? 'close' : 'arrow-back'} size={28} color={t.text} />
        </Pressable>
        <Text style={[s.stepTitle, { color: t.text }]}>Report · {step + 1} of {total}</Text>
        <View style={{ width: 52 }} />
      </View>
      <View style={s.segments} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {Array.from({ length: total }, (_, i) => (
          <View key={i} style={[s.segment, { backgroundColor: i <= step ? t.teal : t.border }]} />
        ))}
      </View>
    </View>
  );

  if (step < steps.length) {
    const p = steps[step];
    return (
      <Screen>
        {header}
        <Title>{p.title}</Title>
        <View style={s.chips} accessibilityRole="radiogroup" accessibilityLabel={p.title}>
          {p.keys.map((k) => (
            <Chip
              key={k}
              label={p.name(k as never)}
              selected={picks[p.key] === k}
              onPress={() => { setPicks({ ...picks, [p.key]: k }); setStep(step + 1); }}
            />
          ))}
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      {header}
      <Title>Anything else? (optional)</Title>
      <Body>Anonymous. Please do not type your own name, number or codes.</Body>
      <Field label="Website in the message" value={domain} onChangeText={setDomain} maxLength={253} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="parcel-track-mu.com" />
      <Field label="What did it say?" value={snippet} onChangeText={setSnippet} maxLength={LIMITS.snippet} multiline placeholder="Your parcel is held, pay Rs 75…" />
      {typeof state === 'object' && <ErrorText>{state.error}</ErrorText>}
      <Button label={state === 'sending' ? 'Sending…' : 'Send report'} icon="send" onPress={submit} disabled={state === 'sending'} />
    </Screen>
  );
}

const s = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  iconBtn: { width: 52, height: 52, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepTitle: { fontFamily: FONT.display, fontSize: 20, fontWeight: '700', flex: 1, textAlign: 'center' },
  segments: { flexDirection: 'row', gap: 6 },
  segment: { flex: 1, height: 8, borderRadius: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
