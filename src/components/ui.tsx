import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT, css, glow, useTheme } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];
type Tone = 'teal' | 'orange';

// Grid background + soft glow at the top (mockup look). Scrolls on short phones, centres on tablets, clears notches.
export function Screen({ children, tone = 'teal' }: { children: ReactNode; tone?: Tone }) {
  const t = useTheme();
  const g = tone === 'teal' ? t.teal : t.orange;
  const bg = css({
    backgroundImage: `radial-gradient(ellipse 90% 40% at 50% 0%, ${g}22, transparent 70%), linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`,
    backgroundSize: '100% 100%, 28px 28px, 28px 28px',
  });
  const { top } = useSafeAreaInsets();
  return (
    <ScrollView style={[{ flex: 1, backgroundColor: t.bg }, bg]} contentContainerStyle={[s.screen, { paddingTop: top + 28 }]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  );
}

export function Eyebrow({ children, color }: { children: ReactNode; color?: string }) {
  const t = useTheme();
  return <Text style={[s.eyebrow, { color: color ?? t.muted }]}>{children}</Text>;
}

export function Title({ children, color }: { children: ReactNode; color?: string }) {
  const t = useTheme();
  return <Text accessibilityRole="header" style={[s.title, { color: color ?? t.text }]}>{children}</Text>;
}

export function Body({ children, color }: { children: ReactNode; color?: string }) {
  const t = useTheme();
  return <Text style={[s.body, { color: color ?? t.muted }]}>{children}</Text>;
}

export function Card({ children, accent, bg }: { children: ReactNode; accent?: string; bg?: string }) {
  const t = useTheme();
  return <View style={[s.card, { backgroundColor: bg ?? t.card, borderColor: accent ?? t.border }]}>{children}</View>;
}

type Kind = 'primary' | 'danger' | 'ghost';
export function Button({ label, onPress, kind = 'primary', icon, disabled }: {
  label: string; onPress: () => void; kind?: Kind; icon?: IconName; disabled?: boolean;
}) {
  const t = useTheme();
  const c = {
    primary: { bg: t.teal, to: t.tealDeep, fg: t.onTeal, border: t.teal },
    danger: { bg: t.orange, to: t.orangeDeep, fg: t.onOrange, border: t.orange },
    ghost: { bg: t.card, to: t.card, fg: t.text, border: t.border },
  }[kind];
  const fx = kind === 'ghost' ? null : [css({ backgroundImage: `linear-gradient(160deg, ${c.bg}, ${c.to})` }), !disabled && glow(c.bg, 24)];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.button, { backgroundColor: c.bg, borderColor: c.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }, fx]}>
      {icon && <Ionicons name={icon} size={26} color={c.fg} />}
      <Text style={[s.buttonText, { color: c.fg }]}>{label}</Text>
    </Pressable>
  );
}

// Small rounded badge: LIVE, HIGH RISK, REPORTED 3×…
export function Pill({ label, color, fg, icon }: { label: string; color: string; fg: string; icon?: IconName }) {
  return (
    <View style={[s.pill, { backgroundColor: color }]}>
      {icon && <Ionicons name={icon} size={16} color={fg} />}
      <Text style={[s.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ label, color, size = 56 }: { label: string; color: string; size?: number }) {
  const t = useTheme();
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderColor: t.bg }]}>
      <Text style={[s.avatarText, { fontSize: size * 0.34 }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

// The glowing hero circle inside concentric rings, with decorative chips around it (hidden from screen readers).
export function Orb({ color, children, chips = [], size = 140 }: { color: string; children: ReactNode; chips?: string[]; size?: number }) {
  const t = useTheme();
  const spots = [{ top: 8, left: 0 }, { top: 36, right: 0 }, { bottom: 36, left: 4 }, { bottom: 8, right: 8 }];
  return (
    <View style={s.orbWrap}>
      <View style={[s.orbOuter, { borderColor: t.border }]}>
        <View style={[s.orbRing, { borderColor: color }]}>
          <View style={[s.orb, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }, css({ backgroundImage: `radial-gradient(circle at 35% 30%, #ffffff55, transparent 60%)` }), glow(color, 48)]}>
            {children}
          </View>
        </View>
      </View>
      {chips.slice(0, 4).map((c, i) => (
        <View key={c} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden style={[s.orbChip, spots[i], { backgroundColor: t.card, borderColor: t.border }]}>
          <Text style={[s.orbChipText, { color: t.teal }]}>{c}</Text>
        </View>
      ))}
    </View>
  );
}

// "Recent checks" style row: dot · text · coloured status word on the right.
export function Row({ dot, label, status, statusColor }: { dot: string; label: string; status?: string; statusColor?: string }) {
  const t = useTheme();
  return (
    <View style={[s.row, { backgroundColor: t.card, borderColor: t.border }]}>
      <View style={[s.dot, { backgroundColor: dot }]} />
      <Text style={[s.rowText, { color: t.text }]}>{label}</Text>
      {!!status && <Text style={[s.rowStatus, { color: statusColor ?? t.muted }]}>{status}</Text>}
    </View>
  );
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[s.chip, { backgroundColor: selected ? t.teal : t.card, borderColor: selected ? t.teal : t.border }]}>
      {selected && <Ionicons name="checkmark" size={20} color={t.onTeal} />}
      <Text style={[s.chipText, { color: selected ? t.onTeal : t.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, ...props }: TextInputProps & { label: string }) {
  const t = useTheme();
  return (
    <View style={{ gap: 8 }}>
      <Text style={[s.label, { color: t.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.muted}
        {...props}
        style={[s.input, { color: t.text, backgroundColor: t.card, borderColor: t.border }, props.multiline && { minHeight: 110 }]}
      />
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  const t = useTheme();
  return (
    <View accessibilityRole="alert" style={s.errorRow}>
      <Ionicons name="alert-circle" size={24} color={t.orange} />
      <Text style={[s.errorText, { color: t.orange }]}>{children}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  screen: { paddingHorizontal: 16, paddingBottom: 48, gap: 18, width: '100%', maxWidth: 560, alignSelf: 'center', flexGrow: 1 },
  eyebrow: { fontFamily: FONT.body, fontSize: 15, fontWeight: '800', letterSpacing: 1.8, textTransform: 'uppercase' },
  title: { fontFamily: FONT.display, fontSize: 34, lineHeight: 40, fontWeight: '700', letterSpacing: -0.6 },
  body: { fontFamily: FONT.body, fontSize: 19, lineHeight: 27 },
  card: { borderWidth: 1, borderRadius: 24, padding: 18, gap: 12 },
  button: { minHeight: 64, borderRadius: 22, borderWidth: 1.5, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  buttonText: { fontFamily: FONT.display, fontSize: 21, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  pillText: { fontFamily: FONT.body, fontSize: 15, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  avatarText: { fontFamily: FONT.display, color: '#FFFFFF', fontWeight: '700' },
  orbWrap: { alignSelf: 'center', width: '100%', maxWidth: 330, alignItems: 'center', justifyContent: 'center', paddingVertical: 10 },
  orbOuter: { padding: 18, borderRadius: 999, borderWidth: 1 },
  orbRing: { padding: 16, borderRadius: 999, borderWidth: 1.5, borderStyle: 'dashed' },
  orb: { alignItems: 'center', justifyContent: 'center' },
  orbChip: { position: 'absolute', borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 7 },
  orbChipText: { fontFamily: FONT.body, fontSize: 16, fontWeight: '700' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: 22, paddingHorizontal: 18, minHeight: 60, paddingVertical: 10 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  rowText: { fontFamily: FONT.body, fontSize: 19, flex: 1 },
  rowStatus: { fontFamily: FONT.body, fontSize: 16, fontWeight: '800', letterSpacing: 0.4 },
  chip: { minHeight: 52, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontFamily: FONT.body, fontSize: 18, fontWeight: '700' },
  label: { fontFamily: FONT.body, fontSize: 19, fontWeight: '800' },
  input: { fontFamily: FONT.body, minHeight: 56, borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, fontSize: 19, textAlignVertical: 'top' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  errorText: { fontFamily: FONT.body, fontSize: 18, fontWeight: '700', flex: 1 },
});
