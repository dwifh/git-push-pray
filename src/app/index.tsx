import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { AlertOverlay, alertPalette, Btn, Flags, Pill, styles, ThemeToggle } from '@/components/scan-ui';
import { sendAlert } from '@/shared/alert';
import { post } from '@/shared/api';
import { FONT_DISPLAY, useTheme, verdictStyle, type Theme } from '@/shared/theme';
import { checkCaller } from '@/shared/caller';
import { INSTITUTION_LABEL, LIMITS, type ScanResult } from '@/shared/types';

// shortcut: MAUCORS link not verified against an official source yet; confirm before the demo.
const MAUCORS = 'https://maucors.govmu.org';

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'result'; result: ScanResult; dismissed: boolean };

// Every localStorage read/write wrapped: private windows can throw (TEAM-PLAN §4).
const load = (k: string) => { try { return globalThis.localStorage?.getItem(k) ?? ''; } catch { return ''; } };
const save = (k: string, v: string) => { try { globalThis.localStorage?.setItem(k, v); } catch {} };

export default function Scan() {
  const t = useTheme();
  const s = styles(t);
  const [text, setText] = useState('');
  const [sender, setSender] = useState('');
  const [number, setNumber] = useState('');
  const [mode, setMode] = useState<'message' | 'call'>('message');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const tooLong = text.length > LIMITS.text;
  const call = mode === 'call';
  const answered = () => router.push('/coach');

  async function check() {
    setState({ kind: 'loading' });
    const res = await post<ScanResult>('/api/scan', { text, sender: sender.trim() || undefined });
    if ('error' in res) return setState({ kind: 'error', message: res.error }); // keep the text so they can retry
    if (!res.clarify) { setText(''); setSender(''); } // clarify: keep it so they can paste the rest
    setState({ kind: 'result', result: res, dismissed: false });
  }
  const report = (r: ScanResult) => router.push({ pathname: '/feed', params: { domain: r.evidence.domains[0] ?? '' } });
  const alarm = state.kind === 'result' && state.result.verdict !== 'SAFE' && !state.dismissed;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <View style={{ flex: 1 }}>
            <Text style={s.greet}>Scam Shield</Text>
            <Text style={s.title}>Got a strange message?</Text>
          </View>
          <ThemeToggle t={t} />
        </View>
        <View style={{ flexDirection: 'row', backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 18, padding: 4 }} accessibilityRole="tablist">
          {(['message', 'call'] as const).map((m) => (
            <Pressable
              key={m}
              accessibilityRole="tab"
              accessibilityState={{ selected: mode === m }}
              onPress={() => { setMode(m); setState({ kind: 'idle' }); }}
              style={{ flex: 1, minHeight: 52, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: mode === m ? t.teal : 'transparent' }}>
              <Text style={{ fontSize: 18, fontWeight: '700', fontFamily: FONT_DISPLAY, color: mode === m ? t.onTeal : t.muted }}>{m === 'message' ? '💬  Messages' : '📞  Calls'}</Text>
            </Pressable>
          ))}
        </View>

        {call ? (
          <>
            <Text style={s.muted}>Someone calling from a strange number? Type it in before you answer. We check it on your phone.</Text>
            <Text style={s.section}>WHO IS CALLING?</Text>
            <View style={s.card}>
              <TextInput
                style={[s.body, { minHeight: 28, fontSize: 22 }]}
                value={number}
                onChangeText={setNumber}
                maxLength={30}
                keyboardType="phone-pad"
                placeholder="e.g. +225 0701 2345"
                placeholderTextColor={t.muted}
                accessibilityLabel="Caller's phone number"
              />
            </View>
            <Btn t={t} primary label="→  Check this number" disabled={!/\d/.test(number)} onPress={() => setState({ kind: 'result', result: checkCaller(number), dismissed: false })} />
            <Btn t={t} label="📞  I already answered the call" onPress={answered} />
          </>
        ) : (
          <>
        <Text style={s.muted}>Paste an SMS, WhatsApp or email message. We check it for scam signs. Never tap its links first.</Text>

        <Text style={s.section}>WHO SENT IT? (OPTIONAL)</Text>
        <View style={s.card}>
          <TextInput
            style={[s.body, { minHeight: 28 }]}
            value={sender}
            onChangeText={setSender}
            maxLength={LIMITS.sender}
            placeholder="Number or name, e.g. MCB or 5712 3456"
            placeholderTextColor={t.muted}
            accessibilityLabel="Who sent the message"
            autoCorrect={false}
          />
        </View>

        <Text style={s.section}>PASTE THE MESSAGE</Text>
        <View style={s.card}>
          <TextInput
            style={[s.input, { fontFamily: undefined, fontSize: 18 }]}
            multiline
            value={text}
            onChangeText={setText}
            placeholder="Paste the whole message here"
            placeholderTextColor={t.muted}
            accessibilityLabel="Message to check"
          />
          {tooLong && <Text style={[s.small, { color: t.orange }]}>This message is too long. Paste at most {LIMITS.text} characters.</Text>}
        </View>

        <Btn t={t} primary label="→  Check this message" disabled={!text.trim() || tooLong || state.kind === 'loading'} onPress={check} />
          </>
        )}

        {state.kind === 'loading' && (
          <View style={[s.card, s.center]}>
            <ActivityIndicator size="large" color={t.teal} />
            <Text style={s.body}>Checking for scam signs…</Text>
          </View>
        )}

        {state.kind === 'error' && (
          <View style={[s.card, { borderColor: t.orange }]}>
            <Text style={[s.h2, { color: t.orange }]}>⚠ Could not check</Text>
            <Text style={s.body}>{state.message}</Text>
          </View>
        )}

        {state.kind === 'result' && !alarm && <ResultView t={t} result={state.result} onReport={() => report(state.result)} onAnswered={call ? answered : undefined} />}
      </ScrollView>

      {state.kind === 'result' && alarm && (
        <ScamAlert result={state.result} onAnswered={call ? answered : undefined} onReport={() => report(state.result)} onDetails={() => setState({ ...state, dismissed: true })} onClose={() => setState({ kind: 'idle' })} />
      )}
    </View>
  );
}

// Full-screen warning over everything (tab bar too): red for HIGH_RISK, yellow for SUSPICIOUS.
// onAnswered set = Calls tab: no message to forward, so the family button becomes "I answered" → Coach.
function ScamAlert({ result, onReport, onDetails, onClose, onAnswered }: { result: ScanResult; onReport: () => void; onDetails: () => void; onClose: () => void; onAnswered?: () => void }) {
  const P = alertPalette(result.verdict);
  const high = result.verdict === 'HIGH_RISK';
  const outline = { flex: 1, minHeight: 60, borderRadius: 18, borderWidth: 2, borderColor: P.fg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 } as const;
  return (
    <AlertOverlay p={P} onClose={onClose}>
      <View style={{ backgroundColor: P.pill, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 }}>
        <Text style={{ color: P.pillText, fontWeight: '800', letterSpacing: 1.5, fontSize: 15 }}>{high ? '⚠ HIGH RISK' : '! SUSPICIOUS'}</Text>
      </View>
      <View style={{ width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: P.line, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: P.solid, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 56, color: P.onSolid, fontWeight: '800' }}>!</Text>
        </View>
      </View>
      <Text style={{ color: P.fg, fontSize: 38, fontWeight: '800', textAlign: 'center', fontFamily: FONT_DISPLAY }}>{high ? (onAnswered ? 'SCAM CALL' : 'THIS IS A SCAM') : 'BE CAREFUL'}</Text>
      <Text style={{ color: P.fg, fontSize: 18, lineHeight: 26, textAlign: 'center' }}>
        {onAnswered
          ? 'Do not answer this call and do not call it back.'
          : high ? 'Do not tap any link, reply, pay or share any code.' : 'This could be a scam. Do not tap links, pay or share codes until you have checked.'}
      </Text>
      {result.flags.length > 0 && (
        <View style={{ alignSelf: 'stretch', borderWidth: 1, borderColor: P.line, borderRadius: 20, padding: 12, gap: 10 }}>
          {result.flags.map((f, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, backgroundColor: P.dim, borderRadius: 14, padding: 14 }}>
              <Text style={{ color: P.pill, fontSize: 18, fontWeight: '800' }}>!</Text>
              <Text style={{ color: P.fg, fontSize: 17, fontWeight: '600', flex: 1, lineHeight: 24 }}>{f}</Text>
            </View>
          ))}
        </View>
      )}
      <View style={{ alignSelf: 'stretch', backgroundColor: P.dim, borderRadius: 16, padding: 16, gap: 6 }}>
        <Text style={{ color: P.fg, fontSize: 17, fontWeight: '600', lineHeight: 24 }}>{result.advice}</Text>
        {result.clarify && <Text style={{ color: P.fg, fontSize: 16, lineHeight: 22, opacity: 0.85 }}>{result.clarify} Tap See details: your message is still in the box.</Text>}
      </View>
      {onAnswered ? (
        <Pressable accessibilityRole="button" onPress={onAnswered} style={{ alignSelf: 'stretch', minHeight: 60, borderRadius: 18, backgroundColor: P.solid, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: P.onSolid, fontSize: 19, fontWeight: '700', fontFamily: FONT_DISPLAY }}>📞  I answered by mistake</Text>
        </Pressable>
      ) : (
        <WarnFamily verdict={high ? 'high risk' : 'suspicious'} fg={P.onSolid} bg={P.solid} label={P.fg} />
      )}
      <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch' }}>
        <Pressable accessibilityRole="link" onPress={() => Linking.openURL(MAUCORS)} style={outline}>
          <Text style={{ color: P.fg, fontSize: 17, fontWeight: '700', textAlign: 'center', fontFamily: FONT_DISPLAY }}>Report to MAUCORS</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onReport} style={outline}>
          <Text style={{ color: P.fg, fontSize: 17, fontWeight: '700', textAlign: 'center', fontFamily: FONT_DISPLAY }}>Warn others</Text>
        </Pressable>
      </View>
      <View style={{ flexDirection: 'row', gap: 24 }}>
        <Pressable accessibilityRole="button" onPress={onDetails} style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text style={{ color: P.fg, fontSize: 17, fontWeight: '700', textDecorationLine: 'underline' }}>See details</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 48, justifyContent: 'center' }}>
          <Text style={{ color: P.fg, fontSize: 17, fontWeight: '700', textDecorationLine: 'underline' }}>{onAnswered ? 'Check another number' : 'Check another message'}</Text>
        </Pressable>
      </View>
    </AlertOverlay>
  );
}

function ResultView({ t, result, onReport, onAnswered }: { t: Theme; result: ScanResult; onReport: () => void; onAnswered?: () => void }) {
  const s = styles(t);
  const v = verdictStyle(t, result.verdict);
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.eyebrow}>CHECK COMPLETE · {(result.metadata.latencyMs / 1000).toFixed(1)} S</Text>
      <View style={s.row}>
        <Pill t={t} color={v.color} text={`${v.icon} ${v.label}`} />
      </View>
      {result.clarify && (
        <View style={[s.card, { borderColor: t.amber }]}>
          <Text style={[s.h2, { color: t.amber }]}>? One more thing</Text>
          <Text style={s.body}>{result.clarify}</Text>
          <Text style={s.muted}>Your message is still in the box above. Add the missing part and check again.</Text>
        </View>
      )}
      <View style={[s.card, { borderColor: v.color }]}>
        <Text style={[s.h2, { color: v.color }]}>{v.icon} {v.label}</Text>
        <Flags t={t} flags={result.flags} />
        <Text style={s.body}>{result.advice}</Text>
      </View>
      {result.verdict !== 'SAFE' && (
        <>
          {!onAnswered && <WarnFamily verdict={result.verdict === 'HIGH_RISK' ? 'high risk' : 'suspicious'} fg={t.onTeal} bg={t.teal} label={t.text} />}
          <Btn t={t} label="Report to MAUCORS" onPress={() => Linking.openURL(MAUCORS)} />
          <Btn t={t} label="Warn others in the Scam Feed" onPress={onReport} />
        </>
      )}
    </View>
  );
}

// WhatsApp the trusted contact (scam_warning). The wa.me link is always shown: Meta can accept and still drop a send.
function WarnFamily({ verdict, fg, bg, label }: { verdict: string; fg: string; bg: string; label: string }) {
  const [to, setTo] = useState(() => load('trustedContact'));
  const [status, setStatus] = useState<'idle' | 'sending' | { sent: boolean; waMe: string }>('idle');
  const digits = to.replace(/\D/g, '');
  const valid = digits.length >= 8 && digits.length <= 15;
  const btn = { alignSelf: 'stretch', minHeight: 60, borderRadius: 18, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', opacity: valid ? 1 : 0.45 } as const;

  async function warn() {
    save('trustedContact', digits);
    setStatus('sending');
    const name = load('firstName').trim().slice(0, 30) || 'a loved one';
    setStatus(await sendAlert({ template: 'scam_warning', to: digits, vars: [name, INSTITUTION_LABEL.OTHER, verdict] }));
  }

  return (
    <View style={{ alignSelf: 'stretch', gap: 10 }}>
      {!load('trustedContact') && (
        <TextInput
          style={{ color: label, borderWidth: 1, borderColor: label, borderRadius: 14, padding: 14, fontSize: 18 }}
          value={to}
          onChangeText={setTo}
          keyboardType="phone-pad"
          placeholder="Family WhatsApp number, e.g. 230 5712 3456"
          placeholderTextColor={label}
          accessibilityLabel="Trusted family member's WhatsApp number with country code"
        />
      )}
      <Pressable accessibilityRole="button" disabled={!valid || status === 'sending'} onPress={warn} style={btn}>
        <Text style={{ color: fg, fontSize: 19, fontWeight: '700', fontFamily: FONT_DISPLAY }}>{status === 'sending' ? 'Sending…' : '💬  Warn family on WhatsApp'}</Text>
      </Pressable>
      {typeof status === 'object' && (
        <>
          <Text style={{ color: label, fontSize: 17, textAlign: 'center' }}>{status.sent ? '✓ Warning sent.' : 'Could not send it automatically.'}</Text>
          <Pressable accessibilityRole="link" onPress={() => Linking.openURL(status.waMe)} style={{ minHeight: 48, justifyContent: 'center', alignItems: 'center' }}>
            <Text style={{ color: label, fontSize: 17, fontWeight: '700', textDecorationLine: 'underline' }}>Open WhatsApp to send it yourself</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}
