import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { post } from '@/shared/api';
import { AlertOverlay, alertPalette, Btn, Flags, Pill, styles, ThemeToggle } from '@/components/scan-ui';
import { FONT_DISPLAY, useTheme, verdictStyle, type Theme } from '@/shared/theme';
import { LIMITS, type EmailResult, type Importance } from '@/shared/types';

type State = { kind: 'idle' } | { kind: 'loading' } | { kind: 'error'; message: string } | { kind: 'result'; result: EmailResult; released: boolean } | { kind: 'deleted' };

const IMPORTANCE: Record<Importance, string> = { URGENT: 'Urgent', ROUTINE: 'Routine', PROMOTIONAL: 'Promotional' };

// Web only: read a picked .eml file as text. Nothing is uploaded until "Check email".
function pickEml(onText: (s: string) => void) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.eml,message/rfc822,text/plain';
  input.onchange = () => void input.files?.[0]?.text().then(onText);
  input.click();
}

export default function Email() {
  const t = useTheme();
  const s = styles(t);
  const [raw, setRaw] = useState('');
  const [state, setState] = useState<State>({ kind: 'idle' });
  const tooLong = raw.length > LIMITS.emailRaw;

  async function check() {
    setState({ kind: 'loading' });
    const res = await post<EmailResult>('/api/email', { raw });
    if ('error' in res) return setState({ kind: 'error', message: res.error }); // keep the text so they can retry
    setRaw(''); // checked: clear the box for the next email
    setState({ kind: 'result', result: res, released: false });
  }
  const quarantined = state.kind === 'result' && state.result.verdict !== 'SAFE' && !state.released;

  return (
    <View style={{ flex: 1 }}>
    <ScrollView style={s.page} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <View style={s.header}>
        <View style={{ flex: 1 }}>
          <Text style={s.greet}>Email Guard</Text>
          <Text style={s.title}>Got a strange email?</Text>
        </View>
        <ThemeToggle t={t} />
      </View>
      <Text style={s.muted}>Paste the email headers or the whole email. We check who really sent it and whether it is a scam.</Text>

      <Text style={s.section}>PASTE THE EMAIL</Text>
      <View style={s.card}>
        <TextInput
          style={s.input}
          multiline
          value={raw}
          onChangeText={setRaw}
          placeholder={'From: ...\nReply-To: ...\nSubject: ...'}
          placeholderTextColor={t.muted}
          accessibilityLabel="Email headers or whole email"
          autoCapitalize="none"
          autoCorrect={false}
        />
        {tooLong && <Text style={[s.small, { color: t.orange }]}>This email is too long. Paste only the headers.</Text>}
      </View>

      <Btn t={t} primary label="→  Check this email" disabled={!raw.trim() || tooLong || state.kind === 'loading'} onPress={check} />
      {Platform.OS === 'web' && <Btn t={t} label="Open an .eml file" onPress={() => pickEml(setRaw)} />}

      {state.kind === 'loading' && (
        <View style={[s.card, s.center]}>
          <ActivityIndicator size="large" color={t.teal} />
          <Text style={s.body}>Checking who sent it…</Text>
        </View>
      )}

      {state.kind === 'error' && (
        <View style={[s.card, { borderColor: t.orange }]}>
          <Text style={[s.h2, { color: t.orange }]}>⚠ Could not check</Text>
          <Text style={s.body}>{state.message}</Text>
        </View>
      )}

      {state.kind === 'deleted' && (
        <View style={s.card}>
          <Text style={s.h2}>✓ Good call</Text>
          <Text style={s.body}>Now delete it in your email app: open the email, tap the bin icon, then empty the Trash folder. Never click its links or reply.</Text>
        </View>
      )}

      {state.kind === 'result' && !quarantined && <ResultView t={t} result={state.result} released={state.released} />}
    </ScrollView>

    {state.kind === 'result' && quarantined && (
      <Quarantine
        result={state.result}
        onDelete={() => setState({ kind: 'deleted' })}
        onReport={() => router.push({ pathname: '/feed', params: { vector: 'EMAIL', domain: state.result.evidence.domains[0] ?? '' } })}
        onRelease={() => setState({ ...state, released: true })}
        onClose={() => setState({ kind: 'idle' })}
      />
    )}
    </View>
  );
}

// Full-screen warning over everything (tab bar too): red for HIGH_RISK, yellow for SUSPICIOUS.

function Quarantine({ result, onDelete, onReport, onRelease, onClose }: {
  result: EmailResult; onDelete: () => void; onReport: () => void; onRelease: () => void; onClose: () => void;
}) {
  const P = alertPalette(result.verdict);
  const outline = { flex: 1, minHeight: 60, borderRadius: 18, borderWidth: 2, borderColor: P.fg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 } as const;
  return (
    <AlertOverlay p={P} onClose={onClose}>
      <View style={{ backgroundColor: P.pill, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 }}>
        <Text style={{ color: P.pillText, fontWeight: '800', letterSpacing: 1.5, fontSize: 15 }}>⚠ POSSIBLE PHISHING</Text>
      </View>
      <View style={{ width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: P.line, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: P.solid, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 52, color: P.onSolid }}>✉</Text>
        </View>
      </View>
      <Text style={{ color: P.fg, fontSize: 38, fontWeight: '800', textAlign: 'center', fontFamily: FONT_DISPLAY }}>QUARANTINED</Text>
      <Text style={{ color: P.fg, fontSize: 18, lineHeight: 26, textAlign: 'center' }}>
        This email needs your review. Do not click its links, open attachments or reply.
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
      <Pressable accessibilityRole="button" onPress={onDelete} style={{ alignSelf: 'stretch', minHeight: 60, borderRadius: 18, backgroundColor: P.solid, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: P.onSolid, fontSize: 19, fontWeight: '700', fontFamily: FONT_DISPLAY }}>🗑  Delete from your email inbox</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch' }}>
        <Pressable accessibilityRole="button" onPress={onReport} style={outline}>
          <Text style={{ color: P.fg, fontSize: 18, fontWeight: '700', fontFamily: FONT_DISPLAY }}>Report</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onRelease} style={outline}>
          <Text style={{ color: P.fg, fontSize: 16, fontWeight: '700', textAlign: 'center', fontFamily: FONT_DISPLAY }}>I recognise this sender</Text>
        </Pressable>
      </View>
      <View style={{ alignSelf: 'stretch', backgroundColor: P.dim, borderRadius: 16, padding: 16, gap: 6 }}>
        <Text style={{ color: P.fg, fontSize: 17, fontWeight: '600', lineHeight: 24 }}>{result.advice}</Text>
        {result.clarify && <Text style={{ color: P.fg, fontSize: 16, lineHeight: 22, opacity: 0.85 }}>{result.clarify}</Text>}
      </View>
      <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 48, justifyContent: 'center' }}>
        <Text style={{ color: P.fg, fontSize: 17, fontWeight: '700', textDecorationLine: 'underline' }}>Check another email</Text>
      </Pressable>
    </AlertOverlay>
  );
}

function ResultView({ t, result, released }: { t: Theme; result: EmailResult; released: boolean }) {
  const s = styles(t);
  const v = verdictStyle(t, result.verdict);
  return (
    <View style={{ gap: 12 }}>
      <Text style={s.eyebrow}>CHECK COMPLETE · {(result.metadata.latencyMs / 1000).toFixed(1)} S</Text>
      <View style={s.row}>
        <Pill t={t} color={result.importance === 'URGENT' ? t.orange : t.teal} text={IMPORTANCE[result.importance]} />
        <Pill t={t} color={v.color} text={`${v.icon} ${v.label}`} />
      </View>
      <View style={s.card}>
        <Text style={[s.h2, { color: v.color }]}>{v.icon} {v.label}</Text>
        {released && <Text style={s.muted}>You marked this sender as known. Still never share passwords or OTPs.</Text>}
        <Flags t={t} flags={result.flags} />
        <Text style={s.body}>{result.advice}</Text>
        {result.clarify && <Text style={s.muted}>{result.clarify}</Text>}
      </View>
    </View>
  );
}

