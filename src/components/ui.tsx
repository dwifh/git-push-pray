import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// Scrolls on short phones, centres on tablets, clears notches.
export function Screen({ children, bg }: { children: ReactNode; bg?: string }) {
  const t = useTheme();
  const { top } = useSafeAreaInsets();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: bg ?? t.bg }} contentContainerStyle={[s.screen, { paddingTop: top + 28 }]} keyboardShouldPersistTaps="handled">
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
    primary: { bg: t.teal, fg: t.onTeal, border: t.teal },
    danger: { bg: t.orange, fg: t.onOrange, border: t.orange },
    ghost: { bg: t.card, fg: t.text, border: t.border },
  }[kind];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [s.button, { backgroundColor: c.bg, borderColor: c.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}>
      {icon && <Ionicons name={icon} size={26} color={c.fg} />}
      <Text style={[s.buttonText, { color: c.fg }]}>{label}</Text>
    </Pressable>
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
  eyebrow: { fontSize: 15, fontWeight: '800', letterSpacing: 1.6, textTransform: 'uppercase' },
  title: { fontSize: 32, lineHeight: 38, fontWeight: '800', letterSpacing: -0.5 },
  body: { fontSize: 19, lineHeight: 27 },
  card: { borderWidth: 1, borderRadius: 24, padding: 18, gap: 12 },
  button: { minHeight: 64, borderRadius: 20, borderWidth: 1.5, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 },
  buttonText: { fontSize: 21, fontWeight: '800', textAlign: 'center', flexShrink: 1 },
  chip: { minHeight: 52, borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontSize: 18, fontWeight: '700' },
  label: { fontSize: 19, fontWeight: '800' },
  input: { minHeight: 56, borderWidth: 1.5, borderRadius: 16, paddingHorizontal: 16, paddingVertical: 12, fontSize: 19, textAlignVertical: 'top' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  errorText: { fontSize: 18, fontWeight: '700', flex: 1 },
});
