import { NextResponse } from 'next/server';
import { requireAuth, type AuthContext } from '@/lib/auth/require-auth';

/** Runs requireAuth; returns the 401/403 response to short-circuit with, or null if authorized. */
export async function guard(req: Request): Promise<{ auth: AuthContext } | { response: NextResponse }> {
  const result = await requireAuth(req);
  if (!result.ok) return { response: result.response };
  return { auth: result.auth };
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse {
  return NextResponse.json(data as object, init);
}

export function fail(status: number, error: string, detail?: unknown): NextResponse {
  return NextResponse.json({ error, ...(detail !== undefined ? { detail } : {}) }, { status });
}
