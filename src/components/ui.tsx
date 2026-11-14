import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View, type PressableStateCallbackType, type TextInputProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { FONT, RADIUS, css, useTheme, useThemeMode } from './theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

// react-native-web also reports hover; React Native's type only lists `pressed`.
export const isHover = (st: PressableStateCallbackType) => !!(st as { hovered?: boolean }).hovered;
// One easing for everything tappable, and one entrance for each page (keyframes and reduced-motion rule: +html.tsx).
export const EASE = css({ transition: 'transform 120ms ease-out, background-color 160ms ease-out, border-color 160ms ease-out, opacity 160ms ease-out' });
// react-native-web turns `dataSet` into data-* attributes; +html.tsx targets [data-stagger]. Not in RN's types.
const STAGGER = { dataSet: { stagger: '' } } as object;
// Decorative layers: never read out, never tappable.
export const DECOR = { pointerEvents: 'none', accessibilityElementsHidden: true, importantForAccessibility: 'no-hide-descendants' } as const;

// Page: a slowly drifting colour wash over a faint grid, then the content, whose blocks rise in one after another.
// Scrolls on short phones, centres on tablets, clears notches. `tone` is still accepted so older callers compile.
export function Screen({ children }: { children: ReactNode; tone?: 'teal' | 'orange' }) {
  const t = useTheme();
  const { top } = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.bg, overflow: 'hidden' }}>
      <View {...DECOR} style={[s.layer, css({ backgroundImage: `linear-gradient(${t.gridLine} 1px, transparent 1px), linear-gradient(90deg, ${t.gridLine} 1px, transparent 1px)`, backgroundSize: '32px 32px' })]} />
      <View {...DECOR} style={[s.aurora, css({ backgroundImage: t.aurora, animation: 'drift 20s ease-in-out infinite alternate', willChange: 'transform' })]} />
      <ScrollView style={{ flex: 1 }} contentContainerStyle={[s.screen, { paddingTop: top + 24 }]} keyboardShouldPersistTaps="handled">
        <View {...STAGGER} style={s.stack}>{children}</View>
      </ScrollView>
    </View>
  );
}

// Leaving a tab before typing or answering anything sends it back to its instruction page; anything entered
// makes it the person's session, kept as it was. The ref holds the latest values for the leave handler.
export function useResetOnLeave(empty: boolean, reset: () => void) {
  const latest = useRef({ empty, reset });
  useEffect(() => { latest.current = { empty, reset }; });
  useFocusEffect(useCallback(() => () => { if (latest.current.empty) latest.current.reset(); }, []));
}

// A number that counts up from 0 when it first shows. Non-numbers ("–") are shown as they are.
export function CountUp({ n, style }: { n: string | number; style?: object }) {
  const target = Number(n);
  const counts = n !== '' && Number.isFinite(target);
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!counts) return;
    // Reduced motion: jump straight to the number on the first frame.
    const ms = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 0 : 1100;
    let raf = 0;
    let start: number | undefined;
    const step = (ts: number) => {
      start ??= ts;
      const p = ms ? Math.min(1, (ts - start) / ms) : 1;
      setV(Math.round(target * (1 - (1 - p) ** 3)));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, counts]);
  // A screen reader hears the final number, never the moving one.
  return <Text accessibilityLabel={String(n)} style={style}>{counts ? v : n}</Text>;
}

// Square 48px icon-only button; always carries a spoken label.
export function IconButton({ icon, label, onPress }: { icon: IconName; label: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(st) => [s.iconBtn, EASE, { backgroundColor: st.pressed || isHover(st) ? t.cardHi : t.card, borderColor: t.border, transform: [{ scale: st.pressed ? 0.95 : 1 }] }]}>
      <Ionicons name={icon} size={22} color={t.text} />
    </Pressable>
  );
}

// Sun = light mode, moon = dark mode; the button shows the mode a tap switches to.
export function ThemeToggle() {
  const [mode, toggle] = useThemeMode();
  const toLight = mode === 'dark';
  return <IconButton icon={toLight ? 'sunny-outline' : 'moon-outline'} label={toLight ? 'Switch to light mode' : 'Switch to dark mode'} onPress={toggle} />;
}

// Top of every page. Main pages: title with the theme toggle beside it. Sub-pages pass `onBack` and get a bar above the title.
export function Header({ eyebrow, title, onBack, right }: { eyebrow?: string; title?: string; onBack?: () => void; right?: ReactNode }) {
  // No title: just the bar (a result page's verdict block is its own title).
  const text = !!title && (
    <View style={s.headerText}>
      {!!eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
      <Title>{title}</Title>
    </View>
  );
  if (!onBack) return <View style={s.header}>{text}{right === undefined ? <ThemeToggle /> : right}</View>;
  return (
    <View style={{ gap: 20 }}>
      <View style={[s.header, { alignItems: 'center' }]}>
        <IconButton icon="chevron-back" label="Back" onPress={onBack} />
        <View style={{ flex: 1 }} />
        {right === undefined ? <ThemeToggle /> : right}
      </View>
      {text}
    </View>
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
  return <View style={[s.card, { backgroundColor: bg ?? t.card, borderColor: accent ?? t.border }, css({ boxShadow: t.shadow })]}>{children}</View>;
}

type Kind = 'primary' | 'danger' | 'ghost';
export function Button({ label, onPress, kind = 'primary', icon, disabled }: {
  label: string; onPress: () => void; kind?: Kind; icon?: IconName; disabled?: boolean;
}) {
  const t = useTheme();
  const c = {
    primary: { bg: t.teal, on: t.tealDeep, fg: t.onTeal, border: 'transparent', grad: t.gradTeal, glow: t.glowTeal },
    danger: { bg: t.orange, on: t.orangeDeep, fg: t.onOrange, border: 'transparent', grad: t.gradOrange, glow: t.glowOrange },
    ghost: { bg: 'transparent', on: t.cardHi, fg: t.text, border: t.borderStrong, grad: 'none', glow: '' },
  }[kind];
  const solid = kind !== 'ghost' && !disabled;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={(st) => {
        const lift = solid && isHover(st) && !st.pressed;
        return [s.button, css({ transition: 'transform 160ms ease-out, box-shadow 200ms ease-out, background-color 160ms ease-out', backgroundImage: c.grad, boxShadow: solid ? `0 ${lift ? 16 : 10}px ${lift ? 32 : 24}px -12px ${c.glow}` : 'none' }),
          { backgroundColor: kind === 'ghost' && (st.pressed || isHover(st)) ? c.on : c.bg, borderColor: c.border, opacity: disabled ? 0.45 : 1, transform: [{ translateY: lift ? -2 : 0 }, { scale: st.pressed ? 0.97 : 1 }] }];
      }}>
      {/* A soft light sweeps across solid buttons every few seconds. */}
      {solid && <View {...DECOR} style={[s.sheen, css({ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.35), transparent)', animation: 'sheen 4.5s ease-in-out 1.2s infinite' })]} />}
      {icon && <Ionicons name={icon} size={22} color={c.fg} />}
      <Text style={[s.buttonText, { color: c.fg }]}>{label}</Text>
    </Pressable>
  );
}

// Small rounded badge: LIVE, HIGH RISK, REPORTED 3×…
export function Pill({ label, color, fg, icon }: { label: string; color: string; fg: string; icon?: IconName }) {
  return (
    <View style={[s.pill, { backgroundColor: color }]}>
      {icon && <Ionicons name={icon} size={14} color={fg} />}
      <Text style={[s.pillText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// A round badge with initials, or an icon when there is no name to show.
export function Avatar({ label, color, size = 56, icon }: { label: string; color: string; size?: number; icon?: IconName }) {
  const t = useTheme();
  return (
    <View style={[s.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color, borderColor: t.card }]}>
      {icon ? <Ionicons name={icon} size={size * 0.42} color="#FFFFFF" /> : <Text style={[s.avatarText, { fontSize: size * 0.34 }]} numberOfLines={1}>{label}</Text>}
    </View>
  );
}

// The hero mark: a glowing circle with ripples and a slowly turning dashed ring, chips floating around it.
// Every layer but the circle is decoration, hidden from screen readers.
export function Orb({ color, grad, glow, children, chips = [], size = 120 }: {
  color: string; grad?: string; glow?: string; children: ReactNode; chips?: string[]; size?: number;
}) {
  const t = useTheme();
  const box = size + 92;
  const spots = [{ top: 6, left: 0 }, { top: 40, right: 0 }, { bottom: 40, left: 0 }, { bottom: 6, right: 6 }];
  const at = (d: number) => ({ position: 'absolute' as const, width: d, height: d, borderRadius: d / 2, top: '50%' as const, left: '50%' as const, marginTop: -d / 2, marginLeft: -d / 2 });
  return (
    <View style={[s.orbWrap, { height: box + 16 }]}>
      <View {...DECOR} style={[at(size * 2), css({ backgroundImage: `radial-gradient(circle, ${glow ?? color + '55'} 0%, transparent 65%)`, animation: 'breathe 4s ease-in-out infinite' })]} />
      {[0, 1.5].map((d) => (
        <View key={d} {...DECOR} style={[at(size), { borderWidth: 2, borderColor: color }, css({ animation: `ripple 3s ease-out ${d}s infinite` })]} />
      ))}
      <View {...DECOR} style={[at(box), { borderWidth: 1, borderColor: t.border }]} />
      <View {...DECOR} style={[at(size + 34), { borderWidth: 1.5, borderStyle: 'dashed', borderColor: t.borderStrong }, css({ animation: 'spin 28s linear infinite' })]} />
      <View style={[at(size), s.orb, { backgroundColor: color }, css({ backgroundImage: grad ?? 'none', boxShadow: `0 0 0 6px ${color}22, 0 24px 48px -12px ${glow ?? color}` })]}>{children}</View>
      {chips.slice(0, 4).map((c, i) => (
        <View key={c} {...DECOR} style={[s.orbChip, spots[i], { backgroundColor: t.card, borderColor: t.border }, css({ boxShadow: t.shadow, animation: `float 5s ease-in-out ${i * 0.7}s infinite` })]}>
          <Text style={[s.orbChipText, { color: t.text }]}>{c}</Text>
        </View>
      ))}
    </View>
  );
}

// Start screen before a tool (Scan, Email), laid out like Coach's: title, ringed icon, one plain line, the start
// button, then "How it works" steps underneath (where Coach has its Family circle).
export function Intro({ eyebrow, title, icon, chips, lead, steps, button, onStart }: {
  eyebrow: string; title: string; icon: IconName; chips: string[]; lead: string; steps: string[]; button: string; onStart: () => void;
}) {
  const t = useTheme();
  return (
    <Screen>
      <Header eyebrow={eyebrow} title={title} />
      <Orb color={t.teal} grad={t.gradTeal} glow={t.glowTeal} chips={chips}>
        <Ionicons name={icon} size={56} color={t.onTeal} />
      </Orb>
      <Body>{lead}</Body>
      <Button label={button} icon="arrow-forward" onPress={onStart} />
      <View style={{ gap: 12 }}>
        <Eyebrow>How it works</Eyebrow>
        <Card>
          {steps.map((x, i) => (
            <View key={x} style={[s.step, i > 0 && { borderTopWidth: 1, borderColor: t.border, paddingTop: 12 }]}>
              <View style={[s.stepNum, { backgroundColor: t.tealSoft }]}>
                <Text style={[s.stepNumText, { color: t.teal }]}>{i + 1}</Text>
              </View>
              <Text style={[s.body, { color: t.text, flex: 1 }]}>{x}</Text>
            </View>
          ))}
        </Card>
      </View>
    </Screen>
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

// Up to three headline numbers in one panel, split by hairlines.
export function Stats({ items }: { items: { n: string | number; label: string }[] }) {
  const t = useTheme();
  return (
    <Card>
      <View style={s.stats}>
        {items.map((x, i) => (
          <View key={x.label} style={[s.stat, i > 0 && { borderLeftWidth: 1, borderColor: t.border, paddingLeft: 12 }]}>
            <CountUp n={x.n} style={[s.statN, { color: t.text }]} />
            <Text style={[s.statLabel, { color: t.muted }]}>{x.label}</Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

// Placeholder block shown while data loads; keeps the layout from jumping.
export function Skeleton({ height }: { height: number }) {
  const t = useTheme();
  return <View style={[{ height, borderRadius: RADIUS.lg, backgroundColor: t.border }, css({ backgroundImage: `linear-gradient(90deg, ${t.border} 25%, ${t.cardHi} 50%, ${t.border} 75%)`, backgroundSize: '200% 100%', animation: 'shimmer 1.6s linear infinite' })]} />;
}

export function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={(st) => [s.chip, EASE, { backgroundColor: selected ? t.tealSoft : st.pressed || isHover(st) ? t.cardHi : t.card, borderColor: selected ? t.teal : t.borderStrong }]}>
      {selected && <Ionicons name="checkmark" size={18} color={t.teal} />}
      <Text style={[s.chipText, { color: selected ? t.teal : t.text }]}>{label}</Text>
    </Pressable>
  );
}

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  const t = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View style={{ gap: 8 }}>
      <Text style={[s.label, { color: t.text }]}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={t.muted}
        {...props}
        onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
        onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
        // The focus ring is the border plus a soft halo, so the browser's own outline is switched off here only.
        style={[s.input, EASE, { color: t.text, backgroundColor: t.card, borderColor: error ? t.orange : focus ? t.teal : t.borderStrong }, css({ outline: 'none', boxShadow: focus ? `0 0 0 3px ${t.teal}40` : 'none' }), props.multiline && { minHeight: 116 }]}
      />
      {!!error && <ErrorText>{error}</ErrorText>}
    </View>
  );
}

// One-line status under an action: orange for a problem, teal (`ok`) for a success. Icon and words, never colour alone.
export function Note({ children, ok }: { children: ReactNode; ok?: boolean }) {
  const t = useTheme();
  return (
    <View accessibilityRole="alert" style={[s.errorRow, { backgroundColor: ok ? t.tealSoft : t.orangeSoft }]}>
      <Ionicons name={ok ? 'checkmark-circle' : 'alert-circle'} size={22} color={ok ? t.teal : t.orange} />
      <Text style={[s.errorText, { color: t.text }]}>{children}</Text>
    </View>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <Note>{children}</Note>;
}

// A framed list of tappable rows (the Home "More tools" look) for secondary actions.
export function Menu({ children }: { children: ReactNode }) {
  const t = useTheme();
  return <View style={[s.menu, { backgroundColor: t.card, borderColor: t.border }, css({ boxShadow: t.shadow })]}>{children}</View>;
}

// `end`: chevron for a page inside the app, "open-outline" for a link that leaves it.
export function MenuRow({ icon, title, text, onPress, end = 'chevron-forward' }: { icon: IconName; title: string; text?: string; onPress: () => void; end?: IconName }) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={text ? `${title}. ${text}` : title}
      onPress={onPress}
      style={(st) => [s.menuRow, EASE, { borderColor: t.border, backgroundColor: st.pressed || isHover(st) ? t.cardHi : 'transparent' }]}>
      <View style={[s.menuIcon, { backgroundColor: t.cardHi, borderColor: t.border }]}>
        <Ionicons name={icon} size={24} color={t.text} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={[s.menuTitle, { color: t.text }]}>{title}</Text>
        {!!text && <Text style={[s.menuText, { color: t.muted }]}>{text}</Text>}
      </View>
      <Ionicons name={end} size={20} color={t.muted} />
    </Pressable>
  );
}

const s = StyleSheet.create({
  screen: { paddingHorizontal: 20, paddingBottom: 40, width: '100%', maxWidth: 600, alignSelf: 'center', flexGrow: 1 },
  stack: { gap: 20, flexGrow: 1 },
  layer: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  // Oversized so its drift never shows an edge.
  aurora: { position: 'absolute', top: '-15%', left: '-15%', right: '-15%', bottom: '-15%' },
  sheen: { position: 'absolute', top: 0, bottom: 0, left: 0, width: '30%' },
  iconBtn: { width: 48, height: 48, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  headerText: { flex: 1, gap: 8 },
  eyebrow: { fontFamily: FONT.body, fontSize: 14, lineHeight: 18, fontWeight: '700', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontFamily: FONT.display, fontSize: 30, lineHeight: 36, fontWeight: '700', letterSpacing: -0.6 },
  body: { fontFamily: FONT.body, fontSize: 18, lineHeight: 27 },
  card: { borderWidth: 1, borderRadius: RADIUS.lg, padding: 18, gap: 12 },
  button: { minHeight: 60, borderRadius: RADIUS.md, borderWidth: 1.5, overflow: 'hidden', paddingHorizontal: 20, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  buttonText: { fontFamily: FONT.display, fontSize: 20, fontWeight: '700', textAlign: 'center', flexShrink: 1 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6 },
  pillText: { fontFamily: FONT.body, fontSize: 14, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  avatar: { alignItems: 'center', justifyContent: 'center', borderWidth: 3 },
  avatarText: { fontFamily: FONT.display, color: '#FFFFFF', fontWeight: '700' },
  orbWrap: { alignSelf: 'center', width: '100%', maxWidth: 340 },
  orb: { alignItems: 'center', justifyContent: 'center' },
  orbChip: { position: 'absolute', borderWidth: 1, borderRadius: RADIUS.pill, paddingHorizontal: 12, paddingVertical: 6 },
  orbChipText: { fontFamily: FONT.body, fontSize: 15, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, borderWidth: 1, borderRadius: RADIUS.md, paddingHorizontal: 16, minHeight: 60, paddingVertical: 10 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  rowText: { fontFamily: FONT.body, fontSize: 18, flex: 1 },
  rowStatus: { fontFamily: FONT.body, fontSize: 15, fontWeight: '700', letterSpacing: 0.4 },
  stats: { flexDirection: 'row', gap: 12 },
  stat: { flex: 1, gap: 4 },
  statN: { fontFamily: FONT.display, fontSize: 32, lineHeight: 36, fontWeight: '700', letterSpacing: -0.5 },
  statLabel: { fontFamily: FONT.body, fontSize: 15, lineHeight: 20 },
  chip: { minHeight: 48, borderRadius: RADIUS.sm, borderWidth: 1.5, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 6 },
  chipText: { fontFamily: FONT.body, fontSize: 17, fontWeight: '600' },
  label: { fontFamily: FONT.body, fontSize: 17, fontWeight: '700' },
  input: { fontFamily: FONT.body, minHeight: 56, borderWidth: 1.5, borderRadius: RADIUS.sm, paddingHorizontal: 16, paddingVertical: 14, fontSize: 18, textAlignVertical: 'top' },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: RADIUS.sm, padding: 14 },
  menu: { borderWidth: 1, borderRadius: RADIUS.lg, overflow: 'hidden' },
  // Every row draws a top line; the -1 margin tucks the first row's line under the frame.
  menuRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 16, paddingVertical: 14, minHeight: 80, borderTopWidth: 1, marginTop: -1 },
  menuIcon: { width: 48, height: 48, borderRadius: RADIUS.sm, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  menuTitle: { fontFamily: FONT.display, fontSize: 19, fontWeight: '700' },
  menuText: { fontFamily: FONT.body, fontSize: 16, lineHeight: 22 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 14 },
  stepNum: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  stepNumText: { fontFamily: FONT.display, fontSize: 17, fontWeight: '700' },
  errorText: { fontFamily: FONT.body, fontSize: 17, lineHeight: 24, fontWeight: '600', flex: 1 },
});
