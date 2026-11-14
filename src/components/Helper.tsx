import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { api } from '@/shared/api';
import { HELP_REPLIES, HELP_REPLY_LABEL, type HelpAnswer, type HelpReply, type HelpView } from '@/shared/types';
import { FONT, useTheme } from './theme';
import { Body, Button, Card, ErrorText, Eyebrow, Field, Header, Screen, type IconName } from './ui';
import { Findings, VerdictHero } from './Verdict';

const REPLY_ICON: Record<HelpReply, IconName> = { CALL_YOU: 'call', DELETE_IT: 'trash-outline', GENUINE: 'checkmark-circle-outline' };

// Helping Hands on the helper's own phone (PLAN §7.3): type the code → the redacted message and its verdict → one answer.
export function Helper({ onDone }: { onDone: () => void }) {
  const t = useTheme();
  const [code, setCode] = useState('');
  const [view, setView] = useState<HelpView>();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Both calls show the server's own words on failure (expired code, already answered, rate limit).
  async function run(call: () => Promise<void>) {
    setBusy(true);
    setError('');
    try {
      await call();
    } catch (e) {
      setError((e as Error).message);
    }
    setBusy(false);
  }
  const open = () => run(async () => setView(await api<HelpView>(`/api/help?code=${code}`)));
  const answer = (reply: HelpReply) => run(async () => {
    await api('/api/help', { code, reply } satisfies HelpAnswer, 'PUT');
    setView((v) => v && { ...v, reply });
  });
  const again = () => { setView(undefined); setCode(''); setError(''); };

  if (!view) {
    return (
      <Screen>
        <Header eyebrow="Helping Hands" title="Enter the help code" onBack={onDone} />
        <Body>Someone asked you to check a message. Type the 6-digit code from their WhatsApp message.</Body>
        <Field
          label="Help code"
          value={code}
          onChangeText={(v) => { setCode(v.replace(/\D/g, '').slice(0, 6)); setError(''); }}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          placeholder="6 digits"
        />
        {!!error && <ErrorText>{error}</ErrorText>}
        <Button label={busy ? 'Opening…' : 'Show the message'} icon="arrow-forward" onPress={open} disabled={code.length !== 6 || busy} />
        <Body>The code works for 30 minutes. Never share it with anyone else.</Body>
      </Screen>
    );
  }

  if (view.reply) {
    return (
      <Screen key="sent">
        <View style={[s.done, { backgroundColor: t.tealSoft }]}>
          <Ionicons name="checkmark" size={32} color={t.teal} />
        </View>
        <Header eyebrow="Answer sent" title={`${view.elderName} can see your answer`} right={null} />
        <Card>
          <Eyebrow>You said</Eyebrow>
          <Text style={[s.said, { color: t.text }]}>{HELP_REPLY_LABEL[view.reply]}</Text>
        </Card>
        <Body>If you can, call them now from your own contacts.</Body>
        <Button label="Check another code" icon="key-outline" onPress={again} />
        <Button label="Done" kind="ghost" onPress={onDone} />
      </Screen>
    );
  }

  // "It's genuine" is never offered on HIGH_RISK (the server refuses it too): a helper can add care, not remove it.
  const replies = HELP_REPLIES.filter((r) => r !== 'GENUINE' || view.verdict !== 'HIGH_RISK');
  return (
    <Screen key="view">
      <Header eyebrow={`${view.elderName} asked for your help`} title="Check this message" onBack={again} />
      <Card>
        <Eyebrow>Their message · private details hidden</Eyebrow>
        {/* Plain text on purpose: never a tappable link to what may be a scam site. */}
        <Text style={[s.message, { color: t.text }]}>{view.text}</Text>
      </Card>
      <VerdictHero verdict={view.verdict} />
      <Findings verdict={view.verdict} flags={view.flags ?? []} advice={view.advice} />
      <View style={{ gap: 12 }} accessibilityRole="radiogroup" accessibilityLabel="Your answer">
        <Eyebrow>Your answer</Eyebrow>
        {replies.map((r, i) => (
          <Button key={r} label={HELP_REPLY_LABEL[r]} kind={i === 0 ? 'primary' : 'ghost'} icon={REPLY_ICON[r]} onPress={() => answer(r)} disabled={busy} />
        ))}
      </View>
      {!!error && <ErrorText>{error}</ErrorText>}
    </Screen>
  );
}

const s = StyleSheet.create({
  done: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  said: { fontFamily: FONT.display, fontSize: 24, lineHeight: 32, fontWeight: '700' },
  message: { fontFamily: FONT.body, fontSize: 18, lineHeight: 27, overflowWrap: 'anywhere' } as object,
});
