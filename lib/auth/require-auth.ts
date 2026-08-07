import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import type { JWTPayload } from 'jose';
import { verifyAccessToken, NotAJwtError } from './oidc';
import { AT_COOKIE, userFromClaims, type SessionUser } from './session';

export interface AuthContext {
  user: SessionUser;
  claims: JWTPayload;
}

export type AuthResult = { ok: true; auth: AuthContext } | { ok: false; response: NextResponse };

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function originIsAllowed(req: Request): boolean {
  const origin = req.headers.get('origin');
  if (!origin) return true; // no Origin header: same-origin nav, curl, server-to-server
  const base = process.env.BASE_URL;
  if (!base) return true;
  try {
    return new URL(origin).origin === new URL(base).origin;
  } catch {
    return false;
  }
}

/**
 * Verifies the caller holds a valid Zitadel-issued JWT. Any successfully
 * authenticated user is treated as a full admin — access control lives in
 * Zitadel (grant the app to whoever should have it), not in this app.
 */
export async function requireAuth(req: Request): Promise<AuthResult> {
  if (MUTATING_METHODS.has(req.method)) {
    if (!originIsAllowed(req)) {
      return { ok: false, response: NextResponse.json({ error: 'bad_origin' }, { status: 403 }) };
    }
    // A cross-site HTML form can't set a custom header without triggering a
    // CORS preflight, which this server (no Access-Control-Allow-Origin) fails.
    if (req.headers.get('x-makerhub-auth') !== '1') {
      return { ok: false, response: NextResponse.json({ error: 'missing_csrf_header' }, { status: 403 }) };
    }
  }

  let token: string | undefined;
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice('Bearer '.length);
  } else {
    token = (await cookies()).get(AT_COOKIE)?.value;
  }

  if (!token) {
    return { ok: false, response: NextResponse.json({ error: 'unauthenticated' }, { status: 401 }) };
  }

  try {
    const claims = await verifyAccessToken(token);
    return { ok: true, auth: { user: userFromClaims(claims), claims } };
  } catch (err) {
    if (err instanceof NotAJwtError) {
      return { ok: false, response: NextResponse.json({ error: 'not_a_jwt', message: err.message }, { status: 401 }) };
    }
    const name = err instanceof Error ? err.name : '';
    if (name === 'JWTExpired') {
      return { ok: false, response: NextResponse.json({ error: 'token_expired' }, { status: 401 }) };
    }
    if (name === 'OperationProcessingError' || /discovery|fetch/i.test(String(err))) {
      return { ok: false, response: NextResponse.json({ error: 'idp_unreachable' }, { status: 503 }) };
    }
    return { ok: false, response: NextResponse.json({ error: 'invalid_token' }, { status: 401 }) };
  }
}
