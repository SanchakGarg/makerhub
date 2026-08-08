import type { SessionUser } from './session';

// Local-preview-only auth bypass. Double-gated so it can never fire in a
// real deployment even if the env var leaks into a production .env:
// requires NODE_ENV !== 'production' AND the explicit opt-in var.
export function devBypassEnabled(): boolean {
  return process.env.NODE_ENV !== 'production' && process.env.MAKERHUB_DEV_BYPASS_AUTH === '1';
}

export const DEV_BYPASS_USER: SessionUser = {
  sub: 'dev-bypass',
  email: 'dev@localhost',
  name: 'Dev preview (auth bypassed)',
};
