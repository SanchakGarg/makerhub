import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { verifyAccessToken } from '@/lib/auth/oidc';
import { AT_COOKIE, userFromClaims } from '@/lib/auth/session';

export const dynamic = 'force-dynamic';

export async function GET() {
  const res = (body: object) => {
    const r = NextResponse.json(body);
    r.headers.set('Cache-Control', 'no-store');
    return r;
  };

  const token = (await cookies()).get(AT_COOKIE)?.value;
  if (!token) return res({ authenticated: false });

  try {
    const claims = await verifyAccessToken(token);
    return res({
      authenticated: true,
      user: userFromClaims(claims),
      expiresAt: typeof claims.exp === 'number' ? claims.exp * 1000 : null,
    });
  } catch {
    return res({ authenticated: false });
  }
}
