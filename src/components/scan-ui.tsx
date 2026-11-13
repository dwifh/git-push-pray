// Shared building blocks for the Scan and Email screens (same look, one place).
import type { ReactNode } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FONT_DISPLAY, gridBackground, toggleTheme, type Theme } from '@/shared/theme';
import type { Verdict } from '@/shared/types';

// Full-screen warning palettes: red for HIGH_RISK (same as Coach "HANG UP NOW"), yellow for SUSPICIOUS.
// fg = text and outlines; solid/onSolid = the filled button; pill/pillText = the top badge.
const RED = { bg: '#8F1D12', top: '#C2452A', fg: '#FFFFFF', solid: '#FFFFFF', onSolid: '#8F1D12', pill: '#FF7A45', pillText: '#3B0A05', dim: 'rgba(255,255,255,0.12)', line: 'rgba(255,255,255,0.35)' };
const YELLOW: typeof RED = { bg: '#F2B705', top: '#FFD84D', fg: '#2A1A00', solid: '#2A1A00', onSolid: '#FFD84D', pill: '#2A1A00', pillText: '#FFD84D', dim: 'rgba(0,0,0,0.08)', line: 'rgba(0,0,0,0.3)' };
export type AlertPalette = typeof RED;
export const alertPalette = (v: Verdict) => (v === 'HIGH_RISK' ? RED : YELLOW);

// Modal, so the warning also covers the tab bar.
export function AlertOverlay({ p, onClose, children }: { p: AlertPalette; onClose: () => void; children: ReactNode }) {
  const web = Platform.OS === 'web' ? ({ backgroundImage: `radial-gradient(ellipse at top, ${p.top}, ${p.bg} 55%)` } as object) : {};
  return (
    <Modal visible animationType="fade" onRequestClose={onClose}>
      <ScrollView style={[{ flex: 1, backgroundColor: p.bg }, web]} contentContainerStyle={{ padding: 24, gap: 16, alignItems: 'center', maxWidth: 560, width: '100%', alignSelf: 'center' }} accessibilityViewIsModal>
        {children}
      </ScrollView>
    </Modal>
  );
}

export function ThemeToggle({ t }: { t: Theme }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={t.scheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onPress={toggleTheme} style={styles(t).iconBtn}>
      <Text style={{ fontSize: 22, color: t.scheme === 'dark' ? t.amber : t.text }}>{t.scheme === 'dark' ? '☀' : '☾'}</Text>
    </Pressable>
  );
}

// Flags are model text: plain <Text>, never links.
export function Flags({ t, flags }: { t: Theme; flags: string[] }) {
  const s = styles(t);
  return flags.map((f, i) => (
    <View key={i} style={s.flag}>
      <Text style={[s.flagNum, { color: t.orange }]}>{i + 1}</Text>
      <Text style={[s.body, { flex: 1 }]}>{f}</Text>
    </View>
  ));
}

export function Pill({ t, color, text }: { t: Theme; color: string; text: string }) {
  return (
    <View style={{ borderWidth: 1.5, borderColor: color, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 6 }}>
      <Text style={{ color, fontWeight: '800', fontSize: 15, letterSpacing: 0.5 }}>{text.toUpperCase()}</Text>
    </View>
  );
}

export function Btn({ t, label, onPress, primary, disabled }: { t: Theme; label: string; onPress: () => void; primary?: boolean; disabled?: boolean }) {
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

export const styles = (t: Theme) =>
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
