import { useEffect, useState, useSyncExternalStore } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { askHelper } from '@/shared/alert';
import { HELP_REPLIES, HELP_REPLY_LABEL, isOneOf, type HelpReply, type Verdict } from '@/shared/types';
import { FONT, RADIUS, css, useTheme } from './theme';
import { Body, Button, Card, Eyebrow, Note } from './ui';
import { useProfile } from './useProfile';

const KEY = 'helpAsk';
const TTL = 30 * 60_000; // the server forgets a request after 30 minutes
const noSubscribe = () => () => {};

// An open ask survives a reload (TEAM-PLAN §4): only its token and start time are kept on the phone.
function openAsk(): string | null {
  try {
    const o = JSON.parse(globalThis.localStorage?.getItem(KEY) ?? 'null');
    return typeof o?.token === 'string' && Date.now() - o.at < TTL ? o.token : null;
  } catch {
    return null;
  }
}
function keep(token?: string) {
  try {
    if (token) globalThis.localStorage?.setItem(KEY, JSON.stringify({ token, at: Date.now() }));
    else globalThis.localStorage?.removeItem(KEY);
  } catch {
    // blocked storage: the ask still works, it just won't survive a reload
  }
}

type Asked = { sent: boolean; waMe: string; token?: string; error?: string };

/**
 * Helping Hands on the elder's phone (PLAN §7.3). With `ask` (a scan result): the "Ask <helper> to check" button,
 * then the wait and the answer. Without it: only an ask left open before a reload. The answer sits beside the
 * verdict and never changes it. Renders nothing when there is no helper set up.
 */
export function AskHelper({ ask }: { ask?: { text: string; sender?: string; verdict: Verdict } }) {
  const t = useTheme();
  const p = useProfile();
  const elder = p?.role === 'elder' ? p : null;
  const name = elder?.helperName ?? 'your helper';
  const stored = useSyncExternalStore(noSubscribe, openAsk, () => null);
  const [asked, setAsked] = useState<'sending' | Asked>();
  const [reply, setReply] = useState<HelpReply | 'expired'>();
  // A new result starts a new ask; the stored one is picked up only on the page with no result.
  const token = typeof asked === 'object' ? asked.token : !asked && !ask ? stored : null;

  useEffect(() => {
    if (!token || reply) return;
    const started = Date.now();
    const id = setInterval(async () => {
      try {
        const res = await fetch(`/api/help?token=${encodeURIComponent(token)}`);
        if (res.status === 404 || Date.now() - started > TTL) {
          keep();
          return setReply('expired');
        }
        const body = await res.json();
        if (res.ok && isOneOf(HELP_REPLIES, body?.reply)) {
          keep();
          setReply(body.reply);
        }
      } catch {
        // offline for a moment: keep waiting
      }
    }, 3000);
    return () => clearInterval(id);
  }, [token, reply]);

  async function send() {
    if (!elder || !ask) return;
    setAsked('sending');
    setReply(undefined);
    const r = await askHelper({ elderName: elder.firstName, to: elder.trustedContact, ...ask }); // never throws
    keep(r.token);
    setAsked(r);
  }

  const call = elder && <Button label={`Call ${name}`} kind="ghost" icon="call" onPress={() => Linking.openURL(`tel:+${elder.trustedContact}`)} />;

  if (reply && reply !== 'expired') {
    return (
      <View accessibilityLiveRegion="polite" style={[s.answer, { backgroundColor: t.tealSoft, borderColor: t.teal }]}>
        <Eyebrow color={t.teal}>{name} says</Eyebrow>
        <Text style={[s.answerText, { color: t.text }]}>{HELP_REPLY_LABEL[reply]}</Text>
      </View>
    );
  }

  if (token && !reply) {
    const sent = typeof asked === 'object' ? asked : null; // null: picked up after a reload, the WhatsApp link is gone
    return (
      <Card>
        <View style={s.head}>
          <View style={[s.dot, { backgroundColor: t.teal }, css({ animation: 'pulse 1.4s ease-in-out infinite' })]} />
          <Text accessibilityLiveRegion="polite" style={[s.title, { color: t.text }]}>Waiting for {name}…</Text>
        </View>
        {sent && !sent.sent ? <Note>Could not send the code automatically. Send it yourself on WhatsApp.</Note> : <Body>Their answer will show here. You can keep this page open.</Body>}
        {/* Shown even when sent: Meta can accept a send and still drop it (PLAN §0). */}
        {sent && <Button label={sent.sent ? 'Resend on WhatsApp' : 'Open WhatsApp to send'} kind={sent.sent ? 'ghost' : 'primary'} icon="logo-whatsapp" onPress={() => Linking.openURL(sent.waMe)} />}
        {call}
      </Card>
    );
  }

  if (!elder || !ask) return reply ? <Note>That help request has expired. Check the message again to ask once more.</Note> : null;

  const failed = typeof asked === 'object' && !asked.token ? asked : null; // no token: the server could not take the request
  return (
    <View style={{ gap: 12 }}>
      {reply === 'expired' && <Note>That help request has expired. You can ask again.</Note>}
      {failed && <Note>{failed.error ?? 'Could not reach your helper.'}</Note>}
      <Button label={asked === 'sending' ? `Asking ${name}…` : `Ask ${name} to check`} icon="people" onPress={send} disabled={asked === 'sending'} />
      {failed && <Button label={`Message ${name} on WhatsApp`} kind="ghost" icon="logo-whatsapp" onPress={() => Linking.openURL(failed.waMe)} />}
      {failed && call}
    </View>
  );
}

const s = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  title: { fontFamily: FONT.display, fontSize: 21, fontWeight: '700', flex: 1 },
  answer: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 20, gap: 8 },
  answerText: { fontFamily: FONT.display, fontSize: 28, lineHeight: 36, fontWeight: '700', letterSpacing: -0.4 },
});
