import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { post } from '@/shared/api';
import { FONT_DISPLAY, gridBackground, toggleTheme, useTheme, verdictStyle, type Theme } from '@/shared/theme';
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
        <Pressable accessibilityRole="button" accessibilityLabel={t.scheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onPress={toggleTheme} style={s.iconBtn}>
          <Text style={{ fontSize: 22, color: t.scheme === 'dark' ? t.amber : t.text }}>{t.scheme === 'dark' ? '☀' : '☾'}</Text>
        </Pressable>
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

// Full-screen red warning on top of the Email screen, same look as the Coach "HANG UP NOW" screen.
const Q = { bg: '#8F1D12', top: '#C2452A', pill: '#FF7A45', white: '#FFFFFF', dim: 'rgba(255,255,255,0.12)', line: 'rgba(255,255,255,0.35)', text: '#3B0A05' };

function Quarantine({ result, onDelete, onReport, onRelease, onClose }: {
  result: EmailResult; onDelete: () => void; onReport: () => void; onRelease: () => void; onClose: () => void;
}) {
  const web = Platform.OS === 'web' ? ({ backgroundImage: `radial-gradient(ellipse at top, ${Q.top}, ${Q.bg} 55%)` } as object) : {};
  const outline = { flex: 1, minHeight: 60, borderRadius: 18, borderWidth: 2, borderColor: Q.white, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 } as const;
  return (
    <ScrollView style={[StyleSheet.absoluteFill, { backgroundColor: Q.bg }, web]} contentContainerStyle={{ padding: 24, gap: 16, alignItems: 'center', maxWidth: 560, width: '100%', alignSelf: 'center' }} accessibilityViewIsModal>
      <View style={{ backgroundColor: Q.pill, borderRadius: 999, paddingHorizontal: 18, paddingVertical: 8 }}>
        <Text style={{ color: Q.text, fontWeight: '800', letterSpacing: 1.5, fontSize: 15 }}>⚠ POSSIBLE PHISHING</Text>
      </View>
      <View style={{ width: 150, height: 150, borderRadius: 75, borderWidth: 1, borderColor: Q.line, alignItems: 'center', justifyContent: 'center' }}>
        <View style={{ width: 120, height: 120, borderRadius: 60, backgroundColor: Q.white, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 52, color: Q.bg }}>✉</Text>
        </View>
      </View>
      <Text style={{ color: Q.white, fontSize: 38, fontWeight: '800', textAlign: 'center', fontFamily: FONT_DISPLAY }}>QUARANTINED</Text>
      <Text style={{ color: Q.white, fontSize: 18, lineHeight: 26, textAlign: 'center' }}>
        This email needs your review. Do not click its links, open attachments or reply.
      </Text>
      {result.flags.length > 0 && (
        <View style={{ alignSelf: 'stretch', borderWidth: 1, borderColor: Q.line, borderRadius: 20, padding: 12, gap: 10 }}>
          {result.flags.map((f, i) => (
            <View key={i} style={{ flexDirection: 'row', gap: 12, backgroundColor: Q.dim, borderRadius: 14, padding: 14 }}>
              <Text style={{ color: Q.pill, fontSize: 18, fontWeight: '800' }}>!</Text>
              <Text style={{ color: Q.white, fontSize: 17, fontWeight: '600', flex: 1, lineHeight: 24 }}>{f}</Text>
            </View>
          ))}
        </View>
      )}
      <Pressable accessibilityRole="button" onPress={onDelete} style={{ alignSelf: 'stretch', minHeight: 60, borderRadius: 18, backgroundColor: Q.white, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ color: Q.bg, fontSize: 19, fontWeight: '700', fontFamily: FONT_DISPLAY }}>🗑  Delete from your email inbox</Text>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 12, alignSelf: 'stretch' }}>
        <Pressable accessibilityRole="button" onPress={onReport} style={outline}>
          <Text style={{ color: Q.white, fontSize: 18, fontWeight: '700', fontFamily: FONT_DISPLAY }}>Report</Text>
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onRelease} style={outline}>
          <Text style={{ color: Q.white, fontSize: 16, fontWeight: '700', textAlign: 'center', fontFamily: FONT_DISPLAY }}>I recognise this sender</Text>
        </Pressable>
      </View>
      <View style={{ alignSelf: 'stretch', backgroundColor: Q.dim, borderRadius: 16, padding: 16, gap: 6 }}>
        <Text style={{ color: Q.white, fontSize: 17, fontWeight: '600', lineHeight: 24 }}>{result.advice}</Text>
        {result.clarify && <Text style={{ color: Q.white, fontSize: 16, lineHeight: 22, opacity: 0.85 }}>{result.clarify}</Text>}
      </View>
      <Pressable accessibilityRole="button" onPress={onClose} style={{ minHeight: 48, justifyContent: 'center' }}>
        <Text style={{ color: Q.white, fontSize: 17, fontWeight: '700', textDecorationLine: 'underline' }}>Check another email</Text>
      </Pressable>
    </ScrollView>
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

// Flags are model text: plain <Text>, never links.
function Flags({ t, flags }: { t: Theme; flags: string[] }) {
  const s = styles(t);
  return flags.map((f, i) => (
    <View key={i} style={s.flag}>
      <Text style={[s.flagNum, { color: t.orange }]}>{i + 1}</Text>
      <Text style={[s.body, { flex: 1 }]}>{f}</Text>
    </View>
  ));
}

function Pill({ t, color, text }: { t: Theme; color: string; text: string }) {
  return (
    <View style={{ borderWidth: 1.5, borderColor: color, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
      <Text style={{ color, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 }}>{text.toUpperCase()}</Text>
    </View>
  );
}

function Btn({ t, label, onPress, primary, disabled }: { t: Theme; label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={{
        minHeight: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
        backgroundColor: primary ? t.teal : t.card, borderWidth: primary ? 0 : 1, borderColor: t.border, opacity: disabled ? 0.45 : 1,
        ...(primary && Platform.OS === 'web'
          ? { backgroundImage: `linear-gradient(90deg, ${t.teal}, ${t.tealDeep})`, boxShadow: `0 6px 24px ${t.teal}40` }
          : {}),
      }}>
      <Text style={{ color: primary ? t.onTeal : t.text, fontSize: 19, fontWeight: '700', fontFamily: FONT_DISPLAY }}>{label}</Text>
    </Pressable>
  );
}

const styles = (t: Theme) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: t.bg, ...gridBackground(t) },
    content: { paddingHorizontal: 20, paddingTop: 36, paddingBottom: 40, gap: 14, maxWidth: 560, width: '100%', alignSelf: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    greet: { color: t.muted, fontSize: 18 },
    iconBtn: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: t.card, borderWidth: 1, borderColor: t.border },
    section: { color: t.muted, fontWeight: '800', letterSpacing: 2, fontSize: 14, marginTop: 6 },
    eyebrow: { color: t.orange, fontWeight: '800', letterSpacing: 2, fontSize: 14 },
    title: { color: t.text, fontSize: 30, fontWeight: '700', fontFamily: FONT_DISPLAY },
    h2: { color: t.text, fontSize: 21, fontWeight: '700', fontFamily: FONT_DISPLAY },
    body: { color: t.text, fontSize: 18, lineHeight: 26 },
    muted: { color: t.muted, fontSize: 17, lineHeight: 24 },
    small: { fontSize: 15 },
    card: { backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 22, padding: 18, gap: 10 },
    center: { alignItems: 'center' },
    row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
    input: { color: t.text, fontSize: 16, minHeight: 160, fontFamily: Platform.select({ web: 'ui-monospace, Menlo, Consolas, monospace', default: 'monospace' }), textAlignVertical: 'top' },
    flag: { flexDirection: 'row', gap: 12, alignItems: 'flex-start', backgroundColor: t.card, borderColor: t.border, borderWidth: 1, borderRadius: 14, padding: 12 },
    flagNum: { fontSize: 20, fontWeight: '800' },
  });
