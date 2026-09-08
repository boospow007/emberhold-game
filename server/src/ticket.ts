// PvP tickets: short-lived, HMAC-signed claims issued by the Cloudflare Worker.
// Format: base64url(json payload) + '.' + base64url(hmac-sha256(payload, secret))
import { createHmac, timingSafeEqual } from 'node:crypto';
export type Claims = {
  id: string;
  name: string;
  exp: number;
  cosmetics?: string[];
};
const b64 = (s: string | Buffer) => Buffer.from(s).toString('base64url');
export function sign(claims: Claims, secret: string) {
  const payload = b64(JSON.stringify(claims));
  const mac = createHmac('sha256', secret).update(payload).digest('base64url');
  return payload + '.' + mac;
}
export function verify(
  ticket: string,
  secret: string,
  now = Date.now(),
): Claims | null {
  const dot = ticket.indexOf('.');
  if (dot < 1) return null;
  const payload = ticket.slice(0, dot),
    mac = ticket.slice(dot + 1);
  const expected = createHmac('sha256', secret)
    .update(payload)
    .digest('base64url');
  if (
    mac.length !== expected.length ||
    !timingSafeEqual(Buffer.from(mac), Buffer.from(expected))
  )
    return null;
  try {
    const claims = JSON.parse(
      Buffer.from(payload, 'base64url').toString(),
    ) as Claims;
    if (typeof claims.id !== 'string' || typeof claims.exp !== 'number')
      return null;
    if (claims.exp < now) return null;
    return claims;
  } catch {
    return null;
  }
}
