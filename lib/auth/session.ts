import type { JWTPayload } from 'jose';

export const AT_COOKIE = 'mh_at';
export const IDT_COOKIE = 'mh_idt';
export const PKCE_COOKIE = 'mh_pkce';

export interface SessionUser {
  sub: string;
  email?: string;
  name?: string;
  picture?: string;
}

function baseUrl(): string {
  return process.env.BASE_URL || 'http://localhost:3000';
}

// A cookie marked Secure is silently dropped by the browser on a plain
// http:// origin (e.g. a makerspace LAN box) — derive from BASE_URL rather
// than hardcoding, or auth becomes an infinite, unexplained login loop.
export function cookiesAreSecure(): boolean {
  if (process.env.AUTH_COOKIE_SECURE === 'true') return true;
  if (process.env.AUTH_COOKIE_SECURE === 'false') return false;
  return baseUrl().startsWith('https://');
}

export function cookieOpts(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure: cookiesAreSecure(),
    path: '/',
    maxAge: maxAgeSeconds,
  };
}

export function userFromClaims(claims: JWTPayload): SessionUser {
  return {
    sub: String(claims.sub),
    email: typeof claims.email === 'string' ? claims.email : undefined,
    name: typeof claims.name === 'string' ? claims.name : undefined,
    picture: typeof claims.picture === 'string' ? claims.picture : undefined,
  };
}
