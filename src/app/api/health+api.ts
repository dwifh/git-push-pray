// Liveness only: no input, no secrets, nothing to rate-limit.
export function GET() {
  return Response.json({ ok: true });
}
