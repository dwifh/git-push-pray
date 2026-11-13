import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import type { Verdict } from './types';

// Colours from the design references: navy + teal + orange. Dark by default; the sun/moon button toggles.
const dark = {
  scheme: 'dark' as 'dark' | 'light',
  bg: '#0A0F1A', card: '#111A2B', border: '#22304A', text: '#F1F5F9', muted: '#9AA8BC',
  teal: '#4FE0C3', tealDeep: '#2BB89E', onTeal: '#06221C', orange: '#FF7A45', amber: '#FBBF24', blue: '#8EA2FF',
  orangeSoft: '#2A1712', tealSoft: '#0F2A27', grid: 'rgba(79,224,195,0.05)',
};
const light: typeof dark = {
  scheme: 'light',
  bg: '#F1F5FA', card: '#FFFFFF', border: '#DCE3EC', text: '#0F172A', muted: '#5B6B80',
  teal: '#14A68C', tealDeep: '#0E8C77', onTeal: '#FFFFFF', orange: '#C2410C', amber: '#A15C07', blue: '#2E4FD6',
  orangeSoft: '#FDEDE6', tealSoft: '#E3F4F0', grid: 'rgba(15,23,42,0.05)',
};
export type Theme = typeof dark;

const KEY = 'theme';
const listeners = new Set<() => void>();
let current: Theme = dark;
try {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined' && localStorage.getItem(KEY) === 'light') current = light;
} catch {}

export function toggleTheme() {
  current = current === dark ? light : dark;
  try { localStorage.setItem(KEY, current.scheme); } catch {}
  listeners.forEach((l) => l());
}
// Server snapshot is dark so SSR and hydration agree; a saved 'light' applies right after.
export const useTheme = (): Theme =>
  useSyncExternalStore((cb) => (listeners.add(cb), () => listeners.delete(cb)), () => current, () => dark);

export const FONT_DISPLAY = Platform.select({ web: '"Space Grotesk", system-ui, sans-serif', default: undefined });

// Faint grid behind every screen, as in the references (web only).
export const gridBackground = (t: Theme) =>
  Platform.OS === 'web'
    ? ({ backgroundImage: `linear-gradient(${t.grid} 1px, transparent 1px), linear-gradient(90deg, ${t.grid} 1px, transparent 1px)`, backgroundSize: '32px 32px' } as object)
    : {};

// A verdict colour always travels with a word and an icon (UI rules).
export const verdictStyle = (t: Theme, v: Verdict) =>
  ({
    SAFE: { color: t.blue, label: 'No known scam signs found', icon: '✓' },
    SUSPICIOUS: { color: t.amber, label: 'Suspicious', icon: '!' },
    HIGH_RISK: { color: t.orange, label: 'High risk', icon: '⚠' },
  })[v];
