import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getOidcConfig } from '@/lib/auth/oidc';
import { AT_COOKIE, IDT_COOKIE } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

async function doLogout(req: Request) {
  const url = new URL(req.url);
  const baseUrl = process.env.BASE_URL || `${url.protocol}//${url.host}`;
  const cookieStore = await cookies();
  const idToken = cookieStore.get(IDT_COOKIE)?.value;

  let dest = `${baseUrl}/`;
  try {
    const cfg = await getOidcConfig();
    if (cfg.end_session_endpoint) {
      const endSession = new URL(cfg.end_session_endpoint);
      if (idToken) endSession.searchParams.set('id_token_hint', idToken);
      endSession.searchParams.set('post_logout_redirect_uri', `${baseUrl}/`);
      dest = endSession.toString();
    }
  } catch {
    // IdP unreachable — fall back to a local-only logout, still a logout.
  }

  const res = NextResponse.redirect(dest);
  res.cookies.delete(AT_COOKIE);
  res.cookies.delete(IDT_COOKIE);
  return res;
}

export async function POST(req: Request) {
  return doLogout(req);
}

export async function GET(req: Request) {
  return doLogout(req);
}
