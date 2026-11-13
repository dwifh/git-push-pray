import { useSyncExternalStore } from 'react';
import { useColorScheme } from 'react-native';

// Teal = safe actions, orange = danger, indigo = neutral. Text/background pairs checked for ≥ 4.5:1 contrast.
const dark = {
  bg: '#060B14', card: '#0F1626', cardHi: '#141D30', border: '#1F2A40', text: '#F1F5F9', muted: '#9AA8BC',
  teal: '#4FE0C4', tealDeep: '#2BB89E', onTeal: '#04231D', tealSoft: '#0E2A2A',
  orange: '#FF7A45', orangeDeep: '#E5531F', onOrange: '#1A0A03', orangeSoft: '#2A1712',
  blue: '#8B9CFF', blueSoft: '#1A2147', purple: '#6D4C9F', purpleSoft: '#1E1830', grid: 'rgba(148,163,184,0.06)',
};
const light: typeof dark = {
  bg: '#F1F4F9', card: '#FFFFFF', cardHi: '#F7F9FC', border: '#D5DDE8', text: '#0B1220', muted: '#56657B',
  teal: '#0B7A66', tealDeep: '#08624F', onTeal: '#FFFFFF', tealSoft: '#E3F5F1',
  orange: '#C2410C', orangeDeep: '#9A3412', onOrange: '#FFFFFF', orangeSoft: '#FFEDE5',
  blue: '#2B4FD6', blueSoft: '#E6EBFF', purple: '#6D4C9F', purpleSoft: '#F1ECFA', grid: 'rgba(15,23,42,0.05)',
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

// The HANG UP screen is red in both modes (CLAUDE.md); white on this red is 8.6:1.
export const ALARM = { bg: '#8E1B14', glow: '#FF7A45', text: '#FFFFFF', soft: 'rgba(255,255,255,0.12)', line: 'rgba(255,255,255,0.28)' };

// Web-only CSS (the demo is the web PWA). Plain gradients/shadows: cheap on low-end phones, fine on Safari.
// Cast because React Native's style types don't list backgroundImage.
export const css = (style: Record<string, string>) => style as object;
export const glow = (color: string, size = 28) => css({ boxShadow: `0 0 ${size}px ${color}66` });
