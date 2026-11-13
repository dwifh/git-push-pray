// Client-safe. Coach "Alert trusted contact" and Scan "Warn family" call this (PLAN D10).
import { renderMessage } from './messages.ts';
import type { AlertRequest } from './types.ts';

/**
 * Asks /api/alert to WhatsApp the trusted contact. Never throws. Always returns the wa.me link:
 * show it as a button even when `sent` is true, because Meta can accept a text send and still drop it
 * (24 h window) and we have no webhook to notice.
 */
export async function sendAlert(req: AlertRequest): Promise<{ sent: boolean; waMe: string }> {
  let waMe = `https://wa.me/${req.to}`;
  try {
    waMe += `?text=${encodeURIComponent(renderMessage(req.template, req.vars))}`;
    const res = await fetch('/api/alert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
    return { sent: res.ok && (await res.json()).sent === true, waMe };
  } catch {
    return { sent: false, waMe }; // offline, 4xx/5xx or a variable the template refuses
  }
}
