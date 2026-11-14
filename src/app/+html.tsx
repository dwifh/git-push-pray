import { ScrollViewStyleReset, useServerDocumentContext } from 'expo-router/html';
import type { PropsWithChildren } from 'react';

// Keyboard focus ring (colour set per theme in _layout.tsx), the app's animations, and the reduced-motion switch that stills them all.
const GLOBAL_CSS = `
:focus-visible { outline: 2px solid var(--focus, #0B7A66); outline-offset: 2px; }
@keyframes rise { from { opacity: 0; transform: translateY(16px) scale(0.985); } }
@keyframes pulse { 50% { opacity: 0.45; } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes breathe { 0%, 100% { transform: scale(0.94); opacity: 0.6; } 50% { transform: scale(1.06); opacity: 1; } }
@keyframes ripple { from { transform: scale(0.9); opacity: 0.7; } to { transform: scale(1.65); opacity: 0; } }
@keyframes float { 50% { transform: translateY(-7px); } }
@keyframes drift { from { transform: translate3d(-4%, -3%, 0) rotate(0deg); } to { transform: translate3d(4%, 3%, 0) rotate(6deg); } }
@keyframes sheen { 0% { transform: translateX(-160%) skewX(-20deg); } 30%, 100% { transform: translateX(420%) skewX(-20deg); } }
@keyframes grow { from { transform: scaleX(0); } }
@keyframes pop { 0% { transform: scale(0.5); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
@keyframes shimmer { from { background-position: 200% 0; } to { background-position: -200% 0; } }
@keyframes blink { 50% { opacity: 0.25; } }
/* Page entrance: each block rises in turn. */
[data-stagger] > * { animation: rise 560ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
[data-stagger] > :nth-child(2) { animation-delay: 70ms; }
[data-stagger] > :nth-child(3) { animation-delay: 140ms; }
[data-stagger] > :nth-child(4) { animation-delay: 210ms; }
[data-stagger] > :nth-child(5) { animation-delay: 280ms; }
[data-stagger] > :nth-child(6) { animation-delay: 350ms; }
[data-stagger] > :nth-child(n+7) { animation-delay: 420ms; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; animation-delay: 0ms !important; transition-duration: 0.01ms !important; }
}
`;

// Web-only root HTML; links the PWA manifest so the site is installable.
// headNodes/bodyNodes carry the app's JS and CSS (SDK 58 server output); without them the page never hydrates.
export default function Root({ children }: PropsWithChildren) {
  const { htmlAttributes, bodyAttributes, headNodes, bodyNodes } = useServerDocumentContext();
  return (
    <html lang="en" {...htmlAttributes}>
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        {/* viewport-fit=cover: lets safe-area insets clear iPhone notches. */}
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no, viewport-fit=cover" />
        {/* Browser bar matches the page colour in each mode (same values as theme.ts bg). */}
        <meta name="theme-color" content="#F4F6F9" media="(prefers-color-scheme: light)" />
        <meta name="theme-color" content="#0A0F18" media="(prefers-color-scheme: dark)" />
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon.png" />
        {/* Design fonts; if offline, the system font is used instead. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Space+Grotesk:wght@500;700&display=swap" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: GLOBAL_CSS }} />
        {headNodes}
      </head>
      <body {...bodyAttributes}>
        {children}
        {bodyNodes}
      </body>
    </html>
  );
}
