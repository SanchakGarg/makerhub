import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOidcConfig, randomToken, pkceChallenge, clientId } from '@/lib/auth/oidc';
import { PKCE_COOKIE, cookieOpts } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

function safeReturnTo(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/') || raw.startsWith('//')) return '/';
  return raw;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const returnTo = safeReturnTo(url.searchParams.get('returnTo'));
  const prompt = url.searchParams.get('prompt');

  let cfg;
  try {
    cfg = await getOidcConfig();
  } catch {
    return NextResponse.json({ error: 'idp_unreachable' }, { status: 503 });
  }

  const verifier = randomToken(32);
  const challenge = await pkceChallenge(verifier);
  const state = randomToken(16);
  const nonce = randomToken(16);
  const baseUrl = process.env.BASE_URL || `${url.protocol}//${url.host}`;

  const authorizeUrl = new URL(cfg.authorization_endpoint);
  authorizeUrl.searchParams.set('response_type', 'code');
  authorizeUrl.searchParams.set('client_id', clientId());
  authorizeUrl.searchParams.set('redirect_uri', `${baseUrl}/api/auth/callback`);
  authorizeUrl.searchParams.set('scope', 'openid profile email');
  authorizeUrl.searchParams.set('state', state);
  authorizeUrl.searchParams.set('nonce', nonce);
  authorizeUrl.searchParams.set('code_challenge', challenge);
  authorizeUrl.searchParams.set('code_challenge_method', 'S256');
  if (prompt === 'none') authorizeUrl.searchParams.set('prompt', 'none');

  (await cookies()).set(
    PKCE_COOKIE,
    JSON.stringify({ state, verifier, nonce, returnTo }),
    cookieOpts(600)
  );

  return NextResponse.redirect(authorizeUrl.toString());
}
