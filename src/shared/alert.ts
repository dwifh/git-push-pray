// Client-safe. Coach "Alert trusted contact" and Scan "Warn family" call this (PLAN D10).
import { renderMessage } from './messages.ts';
import type { AlertRequest, HelpRequest } from './types.ts';

// Device-side fallback when /api/help fails: no code to share, and never the scam text (we never spread a link).
const CALL_ME = 'Please call me. I need help checking a message before I reply to it.';

/**
 * Scan "Ask my helper" (Helping Hands, PLAN §7.3). Never throws. On success keep `token` and poll
 * GET /api/help?token= every 3 s. Always show `waMe` as a button too (same reason as sendAlert).
 */
export async function askHelper(req: HelpRequest): Promise<{ sent: boolean; waMe: string; code?: string; token?: string; error?: string }> {
  let waMe = `https://wa.me/${req.to}?text=${encodeURIComponent(CALL_ME)}`;
  try {
    const res = await fetch('/api/help', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(req) });
    const body = await res.json();
    if (!res.ok || typeof body.code !== 'string') return { sent: false, waMe, error: String(body.error ?? 'Could not reach your helper.') };
    waMe = `https://wa.me/${req.to}?text=${encodeURIComponent(renderMessage('help_request', [req.elderName, body.code]))}`;
    return { sent: body.sent === true, waMe, code: body.code, token: body.token };
  } catch {
    return { sent: false, waMe, error: 'Could not reach your helper. Check your internet, or call them.' };
  }
}

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
