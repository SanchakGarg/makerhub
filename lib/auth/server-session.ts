import { cookies } from 'next/headers';
import { verifyAccessToken } from './oidc';
import { AT_COOKIE, userFromClaims, type SessionUser } from './session';

/**
 * Session lookup for Server Components. Unlike requireAuth() there is no
 * CSRF/origin check: this only ever guards rendering a GET page, never a
 * mutation. Mutations still go through the API routes, which guard themselves.
 *
 * Returning null (rather than throwing) lets a layout render a sign-in screen
 * without ever sending the admin UI or its data to an unauthenticated browser.
 *
 * IMPORTANT: every admin *page* must call this for itself, not lean on the
 * admin layout's check. Next.js renders and serializes each route segment
 * independently, so a page that renders machine data still ships that data in
 * the flight payload even when its layout replaced it with the sign-in screen.
 */
export async function getServerUser(): Promise<SessionUser | null> {
  const token = (await cookies()).get(AT_COOKIE)?.value;
  if (!token) return null;

  try {
    return userFromClaims(await verifyAccessToken(token));
  } catch {
    return null;
  }
}
