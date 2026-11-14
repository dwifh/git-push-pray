import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '@/shared/api';
import { DISTRICT_LABEL, VECTOR_LABEL, institutionLabel } from '@/shared/feed';
import { DISTRICTS, INSTITUTIONS, LIMITS, VECTORS, type District, type Institution, type Report, type ReportResponse, type Vector } from '@/shared/types';
import { FONT, useTheme } from './theme';
import { Body, Button, Chip, ErrorText, Field, Header, Screen } from './ui';

function Pick<K extends string>({ label, keys, name, value, onChange }: {
  label: string; keys: readonly K[]; name: (k: K) => string; value?: K; onChange: (k: K) => void;
}) {
  const t = useTheme();
  return (
    <View style={{ gap: 10 }} accessibilityRole="radiogroup" accessibilityLabel={label}>
      <Text style={[s.label, { color: t.text }]}>{label}</Text>
      <View style={s.chips}>
        {keys.map((k) => <Chip key={k} label={name(k)} selected={value === k} onPress={() => onChange(k)} />)}
      </View>
    </View>
  );
}

// `initial` pre-fills what a scan already knows; `backLabel` names the page the person came from.
export function ReportForm({ onDone, initial, backLabel = 'Back to the feed' }: { onDone: (sent: boolean) => void; initial?: { domain?: string; vector?: Vector }; backLabel?: string }) {
  const t = useTheme();
  const [institution, setInstitution] = useState<Institution>();
  const [vector, setVector] = useState(initial?.vector);
  const [district, setDistrict] = useState<District>();
  const [domain, setDomain] = useState(initial?.domain ?? '');
  const [snippet, setSnippet] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | { error: string }>('idle');

  async function submit() {
    if (!institution || !vector || !district) return;
    setState('sending');
    try {
      const body: Report = { institution, vector, district, domain: domain.trim() || undefined, snippet: snippet.trim() || undefined };
      await api<ReportResponse>('/api/reports', body);
      setState('sent');
    } catch (e) {
      setState({ error: (e as Error).message });
    }
  }

  if (state === 'sent') {
    return (
      <Screen>
        <View style={[s.done, { backgroundColor: t.tealSoft }]}>
          <Ionicons name="checkmark" size={32} color={t.teal} />
        </View>
        <Header eyebrow="Report sent" title="Thank you" right={null} />
        <Body>Your report helps warn other people in Mauritius. It is anonymous.</Body>
        <Button label={backLabel} icon="arrow-back" onPress={() => onDone(true)} />
      </Screen>
    );
  }

  const ready = !!(institution && vector && district) && state !== 'sending';
  return (
    <Screen>
      <Header eyebrow="Report a scam" title="Tell others what you saw" onBack={() => onDone(false)} />
      <Body>Anonymous. Please do not type your own name, number or codes.</Body>
      <Pick label="Who did they pretend to be?" keys={INSTITUTIONS} name={institutionLabel} value={institution} onChange={setInstitution} />
      <Pick label="How did it reach you?" keys={VECTORS} name={(k) => VECTOR_LABEL[k]} value={vector} onChange={setVector} />
      <Pick label="Where do you live?" keys={DISTRICTS} name={(k) => DISTRICT_LABEL[k]} value={district} onChange={setDistrict} />
      <Field label="Website in the message (optional)" value={domain} onChangeText={setDomain} maxLength={253} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="parcel-track-mu.com" />
      <Field label="What did it say? (optional)" value={snippet} onChangeText={setSnippet} maxLength={LIMITS.snippet} multiline placeholder="Your parcel is held, pay Rs 75…" />
      {typeof state === 'object' && <ErrorText>{state.error}</ErrorText>}
      {!ready && state !== 'sending' && <Body>Choose one answer in each of the three lists to send.</Body>}
      <Button label={state === 'sending' ? 'Sending…' : 'Send report'} icon="send" onPress={submit} disabled={!ready} />
      <Button label="Cancel" kind="ghost" onPress={() => onDone(false)} />
    </Screen>
  );
}

const s = StyleSheet.create({
  label: { fontFamily: FONT.body, fontSize: 17, fontWeight: '700' },
  done: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
});
