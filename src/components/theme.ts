import { useColorScheme } from 'react-native';

// Teal = safe actions, orange = danger. Text/background pairs checked for ≥ 4.5:1 contrast.
const dark = {
  bg: '#070B14', card: '#0F1626', border: '#1F2A40', text: '#F1F5F9', muted: '#9AA8BC',
  teal: '#4FE0C4', onTeal: '#04231D', tealSoft: '#0E2A2A', orange: '#FF7A45', onOrange: '#1A0A03', orangeSoft: '#2A1712', blue: '#8B9CFF',
};
const light: typeof dark = {
  bg: '#F1F4F9', card: '#FFFFFF', border: '#D5DDE8', text: '#0B1220', muted: '#56657B',
  teal: '#0B7A66', onTeal: '#FFFFFF', tealSoft: '#E3F5F1', orange: '#C2410C', onOrange: '#FFFFFF', orangeSoft: '#FFEDE5', blue: '#2B4FD6',
};

export type Theme = typeof dark;
export const useTheme = () => (useColorScheme() === 'dark' ? dark : light);

// The HANG UP screen is red in both modes (CLAUDE.md); white on this red is 6.5:1.
export const ALARM = { bg: '#B3261E', text: '#FFFFFF', soft: 'rgba(255,255,255,0.14)' };
