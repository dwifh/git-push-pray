import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';
import type { Verdict } from '@/shared/types';

// Teal = safe actions, orange = danger, indigo = neutral. Text/background pairs checked for ≥ 4.5:1 contrast;
// `borderStrong` (inputs, outlined buttons) is ≥ 3:1 against bg and card. `border` is a decorative hairline.
const dark = {
  bg: '#0A0F18', card: '#111824', cardHi: '#172030', border: '#243044', borderStrong: '#566782', text: '#EDF1F7', muted: '#9BA7B9',
  teal: '#45D0B5', tealDeep: '#2FB79C', onTeal: '#04231D', tealSoft: '#0F2A29',
  orange: '#FF8250', orangeDeep: '#F0652F', onOrange: '#2A0E03', orangeSoft: '#2B1810',
  blue: '#93A3FF', blueSoft: '#1A2147', amber: '#FBBF24', purple: '#6D4C9F', purpleSoft: '#1E1830',
  shadow: 'inset 0 1px 0 rgba(255,255,255,0.05), 0 18px 40px -24px rgba(0,0,0,0.7)',
  // Hero effects: gradients keep the solid colour as backgroundColor, so text contrast holds if they don't render.
  gradTeal: 'linear-gradient(135deg, #6FF0D6 0%, #2FB79C 100%)',
  gradOrange: 'linear-gradient(135deg, #FFA477 0%, #F0652F 100%)',
  glowTeal: 'rgba(69,208,181,0.45)', glowOrange: 'rgba(255,130,80,0.45)',
  aurora: 'radial-gradient(40% 35% at 12% 8%, rgba(69,208,181,0.20), transparent 70%), radial-gradient(35% 30% at 92% 22%, rgba(147,163,255,0.16), transparent 70%), radial-gradient(45% 40% at 70% 96%, rgba(255,130,80,0.12), transparent 70%)',
  gridLine: 'rgba(255,255,255,0.03)', glass: 'rgba(17,24,36,0.78)',
};
const light: typeof dark = {
  bg: '#F4F6F9', card: '#FFFFFF', cardHi: '#F6F8FA', border: '#DDE3EB', borderStrong: '#7C899E', text: '#0D1524', muted: '#536074',
  teal: '#0B7A66', tealDeep: '#086352', onTeal: '#FFFFFF', tealSoft: '#E4F4F0',
  orange: '#C2410C', orangeDeep: '#9A3412', onOrange: '#FFFFFF', orangeSoft: '#FDEEE6',
  blue: '#2B4FD6', blueSoft: '#E8ECFF', amber: '#A15C07', purple: '#6D4C9F', purpleSoft: '#F1ECFA',
  shadow: '0 1px 2px rgba(13,21,36,0.05), 0 10px 24px -14px rgba(13,21,36,0.14)',
  gradTeal: 'linear-gradient(135deg, #0E9C86 0%, #075446 100%)',
  gradOrange: 'linear-gradient(135deg, #D9541A 0%, #9A3412 100%)',
  glowTeal: 'rgba(11,122,102,0.30)', glowOrange: 'rgba(194,65,12,0.30)',
  aurora: 'radial-gradient(40% 35% at 12% 8%, rgba(14,156,134,0.14), transparent 70%), radial-gradient(35% 30% at 92% 22%, rgba(43,79,214,0.10), transparent 70%), radial-gradient(45% 40% at 70% 96%, rgba(194,65,12,0.08), transparent 70%)',
  gridLine: 'rgba(13,21,36,0.04)', glass: 'rgba(255,255,255,0.82)',
};

export type Theme = typeof dark;
type Mode = 'light' | 'dark';

// The user's sun/moon choice, kept on this phone. null = follow the phone's own setting.
const KEY = 'theme';
let choice: Mode | null | undefined; // undefined = not read from storage yet
const listeners = new Set<() => void>();
function readChoice(): Mode | null {
  if (choice === undefined) {
    try {
      const v = globalThis.localStorage?.getItem(KEY);
      choice = v === 'light' || v === 'dark' ? v : null;
    } catch {
      choice = null;
    }
  }
  return choice;
}
const subscribe = (fn: () => void) => (listeners.add(fn), () => void listeners.delete(fn));

// The server can't see the phone's scheme or storage: hydrate with light, then switch, so no stale server styles stay.
export function useThemeMode(): [Mode, () => void] {
  const system = useColorScheme() === 'dark' ? 'dark' : 'light';
  const picked = useSyncExternalStore(subscribe, readChoice, () => 'server' as const);
  const mode: Mode = picked === 'server' ? 'light' : picked ?? system;
  const toggle = () => {
    choice = mode === 'dark' ? 'light' : 'dark';
    try {
      globalThis.localStorage?.setItem(KEY, choice);
    } catch {}
    listeners.forEach((fn) => fn());
  };
  return [mode, toggle];
}

export const useTheme = () => (useThemeMode()[0] === 'dark' ? dark : light);

// Headings and numbers: Space Grotesk; body: Inter (loaded in +html.tsx). System fonts if offline.
export const FONT = {
  display: '"Space Grotesk", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  body: 'Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  mono: 'ui-monospace, "SF Mono", Menlo, Consolas, monospace',
};

// One radius scale for the whole app: controls, cards, pills.
export const RADIUS = { sm: 12, md: 16, lg: 20, pill: 999 };

// The HANG UP screen is red in both modes (CLAUDE.md); white on this red is 9:1.
export const ALARM = { bg: '#8E1B14', ink: '#5E0F0A', badge: '#FFB199', text: '#FFFFFF', soft: 'rgba(255,255,255,0.10)', line: 'rgba(255,255,255,0.30)' };

// A verdict colour always travels with a word and an icon (UI rules). Used by the Scan and Email pages.
export const verdictStyle = (t: Theme, v: Verdict) =>
  ({
    SAFE: { color: t.blue, label: 'No known scam signs found', icon: '✓' },
    SUSPICIOUS: { color: t.amber, label: 'Suspicious', icon: '!' },
    HIGH_RISK: { color: t.orange, label: 'High risk', icon: '⚠' },
  })[v];

// Web-only CSS (the demo is the web PWA). Cast because React Native's style types don't list these properties.
export const css = (style: Record<string, string>) => style as object;
