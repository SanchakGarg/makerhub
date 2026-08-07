import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOidcConfig, verifyIdToken, verifyAccessToken, clientId } from '@/lib/auth/oidc';
import { AT_COOKIE, IDT_COOKIE, PKCE_COOKIE, cookieOpts } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const baseUrl = process.env.BASE_URL || `${url.protocol}//${url.host}`;
  const cookieStore = await cookies();
  const pkceRaw = cookieStore.get(PKCE_COOKIE)?.value;

  const fail = (reason: string) => {
    const dest = new URL('/', baseUrl);
    dest.searchParams.set('auth_error', reason);
    const res = NextResponse.redirect(dest.toString());
    res.cookies.delete(PKCE_COOKIE);
    return res;
  };

  if (!pkceRaw) return fail('expired');

  let pkce: { state: string; verifier: string; nonce: string; returnTo: string };
  try {
    pkce = JSON.parse(pkceRaw);
  } catch {
    return fail('expired');
  }

  const idpError = url.searchParams.get('error');
  if (idpError) return fail(idpError);

  const state = url.searchParams.get('state');
  if (!state || state !== pkce.state) return fail('state_mismatch');

  const code = url.searchParams.get('code');
  if (!code) return fail('missing_code');

  let cfg;
  try {
    cfg = await getOidcConfig();
  } catch {
    return fail('idp_unreachable');
  }

  const redirectUri = `${baseUrl}/api/auth/callback`;
  const tokenRes = await fetch(cfg.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
      client_id: clientId(),
      code_verifier: pkce.verifier,
    }),
    cache: 'no-store',
  });

  if (!tokenRes.ok) {
    console.error('Zitadel token exchange failed:', tokenRes.status, await tokenRes.text().catch(() => ''));
    return fail('token_exchange');
  }

  const tokens = (await tokenRes.json()) as {
    access_token: string;
    id_token: string;
    expires_in: number;
  };

  try {
    await verifyIdToken(tokens.id_token, pkce.nonce);
    await verifyAccessToken(tokens.access_token);
  } catch (err) {
    console.error('Zitadel token verification failed:', err);
    return fail('token_verification');
  }

  const dest = new URL(pkce.returnTo, baseUrl);
  const res = NextResponse.redirect(dest.toString());
  res.cookies.delete(PKCE_COOKIE);
  res.cookies.set(AT_COOKIE, tokens.access_token, cookieOpts(tokens.expires_in));
  res.cookies.set(IDT_COOKIE, tokens.id_token, cookieOpts(tokens.expires_in));
  return res;
}
