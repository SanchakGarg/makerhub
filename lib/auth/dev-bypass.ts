import type { SessionUser } from './session';

// Local-preview-only auth bypass. Gated on two conditions so it can never
// fire in a real deployment even if the env var leaks into a production
// .env: the explicit opt-in var AND no real Zitadel issuer configured. A
// real deployment always has ZITADEL_ISSUER set (login can't work without
// it), so this is a stronger guarantee than NODE_ENV — which a production
// *build* (needed to avoid the dev-mode HMR websocket) sets to
// "production" regardless of whether it's a real deployment.
export function devBypassEnabled(): boolean {
  return process.env.MAKERHUB_DEV_BYPASS_AUTH === '1' && !process.env.ZITADEL_ISSUER;
}

export const DEV_BYPASS_USER: SessionUser = {
  sub: 'dev-bypass',
  email: 'dev@localhost',
  name: 'Dev preview (auth bypassed)',
};
